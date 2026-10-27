"""Reproducible, leakage-aware Cell2Cell modelling and historical risk scoring.

Run from the project root with .venv/Scripts/python.exe src/analysis_models.py.
All selection uses validation only; final test results are written once afterwards.
"""
from __future__ import annotations

import hashlib
import importlib.metadata
import json
import math
import time
import inspect
from pathlib import Path

try:
    from .runtime_compat import repair_windows_threadpool_paths
except ImportError:
    from runtime_compat import repair_windows_threadpool_paths
repair_windows_threadpool_paths()

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, average_precision_score, brier_score_loss, confusion_matrix,
    f1_score, log_loss, precision_recall_curve, precision_score, recall_score,
    roc_auc_score, roc_curve,
)
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from threadpoolctl import threadpool_limits

RANDOM_STATE = 42
BASE = Path(__file__).resolve().parents[1]
DATA = BASE / "data"
OUT = BASE / "output" / "analysis"
TARGET = "Churn"
ID = "CustomerID"
RETENTION = ["RetentionCalls", "RetentionOffersAccepted", "MadeCallToRetentionTeam"]
EXCLUDED_IDENTIFIERS = [ID, "ServiceArea"]


def native(value):
    if isinstance(value, dict):
        return {str(k): native(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, np.ndarray)):
        return [native(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return None if not np.isfinite(value) else float(value)
    if isinstance(value, Path):
        return str(value)
    return value


def write_json(path, value):
    path.write_text(json.dumps(native(value), ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")


def feature_engineering(frame):
    """Only row-local arithmetic: no statistics or fitted thresholds from held-out data."""
    x = frame.drop(columns=[c for c in [TARGET, *EXCLUDED_IDENTIFIERS, *RETENTION] if c in frame]).copy()
    definitions = []
    for col in ["AgeHH1", "AgeHH2"]:
        if col in x:
            x[col] = pd.to_numeric(x[col], errors="coerce").replace(0, np.nan)
            definitions.append({"feature": col, "formula": "0 is not an adult household age: treated as unknown and imputed within train with a missing indicator."})
    if "IncomeGroup" in x:
        codes = pd.to_numeric(x["IncomeGroup"], errors="coerce")
        x["IncomeGroup"] = codes.map(lambda value: "Unknown" if pd.isna(value) or value == 0 else f"Group {value:g}")
        definitions.append({"feature": "IncomeGroup", "formula": "0 -> Unknown; other codes treated as categories to avoid an assumed equal income gap."})
    if "HandsetPrice" in x:
        x["HandsetPrice"] = pd.to_numeric(x["HandsetPrice"], errors="coerce")
        definitions.append({"feature": "HandsetPrice", "formula": "Numeric price; Unknown -> missing; train median imputation plus missing indicator. Currency not specified."})
    recipes = [
        ("revenue_per_minute", "MonthlyRevenue", "MonthlyMinutes", 1.0),
        ("active_sub_ratio", "ActiveSubs", "UniqueSubs", 1.0),
        ("care_calls_per_1000_minutes", "CustomerCareCalls", "MonthlyMinutes", 1000.0),
        ("quality_calls_per_1000_minutes", "DroppedBlockedCalls", "MonthlyMinutes", 1000.0),
    ]
    for name, numerator, denominator, factor in recipes:
        if numerator in x and denominator in x:
            x[name] = factor * x[numerator] / x[denominator].replace(0, np.nan)
            definitions.append({"feature": name, "formula": f"{factor:g} * {numerator} / {denominator}; denominator=0 -> missing"})
    for col in x:
        if pd.api.types.is_numeric_dtype(x[col]):
            x[col] = pd.to_numeric(x[col], errors="coerce").replace([np.inf, -np.inf], np.nan).astype(float)
        else:
            x[col] = x[col].astype(object).where(x[col].notna(), np.nan)
    return x, definitions


def preprocess(x):
    numeric = x.select_dtypes(include="number").columns.tolist()
    categorical = [c for c in x if c not in numeric]
    return ColumnTransformer([
        ("numeric", Pipeline([("impute", SimpleImputer(strategy="median", add_indicator=True)), ("scale", StandardScaler())]), numeric),
        ("categorical", Pipeline([("impute", SimpleImputer(strategy="constant", fill_value="Unknown")), ("encode", OneHotEncoder(handle_unknown="ignore", sparse_output=False))]), categorical),
    ], remainder="drop", verbose_feature_names_out=True), numeric, categorical


def model_candidates(x):
    prep, numeric, categorical = preprocess(x)
    candidates = {
        "Logistic Regression": LogisticRegression(C=0.7, max_iter=2000, solver="lbfgs", random_state=RANDOM_STATE),
        "Random Forest": RandomForestClassifier(n_estimators=240, max_depth=15, min_samples_leaf=20, max_features="sqrt", n_jobs=4, random_state=RANDOM_STATE),
        "Histogram Gradient Boosting": HistGradientBoostingClassifier(max_iter=240, learning_rate=0.06, max_leaf_nodes=15, l2_regularization=8.0, min_samples_leaf=40, early_stopping=False, random_state=RANDOM_STATE),
    }
    return {name: Pipeline([("preprocess", clone(prep)), ("model", classifier)]) for name, classifier in candidates.items()}, numeric, categorical


def metric_row(y, p, threshold=0.5):
    predicted = np.asarray(p) >= threshold
    tn, fp, fn, tp = confusion_matrix(y, predicted, labels=[0, 1]).ravel()
    return {
        "threshold": float(threshold), "n": len(y), "churn_count": int(np.sum(y)),
        "churn_rate": float(np.mean(y)), "accuracy": accuracy_score(y, predicted),
        "precision": precision_score(y, predicted, zero_division=0),
        "recall": recall_score(y, predicted, zero_division=0), "f1": f1_score(y, predicted, zero_division=0),
        "roc_auc": roc_auc_score(y, p), "pr_auc_average_precision": average_precision_score(y, p),
        "brier_score": brier_score_loss(y, p), "log_loss": log_loss(y, p),
        "targeted_n": int(np.sum(predicted)), "targeted_fraction": float(np.mean(predicted)),
        "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp),
    }


def targeting_table(y, p, fractions=(.05, .1, .2, .3)):
    y = np.asarray(y)
    order = np.argsort(-np.asarray(p), kind="stable")
    n = len(y)
    rows = []
    for fraction in fractions:
        k = math.ceil(n * fraction)
        churn = int(y[order[:k]].sum())
        precision = churn / k
        rows.append({"capacity": fraction, "customers": k, "actual_churn": churn, "precision": precision, "capture_recall": churn / y.sum(), "lift": precision / y.mean(), "minimum_score": float(np.asarray(p)[order[k - 1]])})
    return pd.DataFrame(rows)


def decile_table(y, p):
    y = np.asarray(y)
    order = np.argsort(-np.asarray(p), kind="stable")
    chunks = np.array_split(order, 10)
    rows, cumulative_churn, cumulative_n = [], 0, 0
    for i, chunk in enumerate(chunks, 1):
        churn = int(y[chunk].sum())
        cumulative_churn += churn
        cumulative_n += len(chunk)
        rows.append({"decile": i, "customers": len(chunk), "actual_churn": churn, "churn_rate": churn / len(chunk), "min_probability": float(np.min(np.asarray(p)[chunk])), "max_probability": float(np.max(np.asarray(p)[chunk])), "cumulative_customers": cumulative_n, "cumulative_fraction": cumulative_n / len(y), "cumulative_capture": cumulative_churn / y.sum(), "cumulative_lift": (cumulative_churn / cumulative_n) / y.mean()})
    return pd.DataFrame(rows)


def curve_tables(y, p, prefix):
    fpr, tpr, thresholds = roc_curve(y, p)
    pd.DataFrame({"false_positive_rate": fpr, "true_positive_rate": tpr, "threshold": thresholds}).to_csv(OUT / f"{prefix}_roc.csv", index=False)
    precision, recall, thresholds = precision_recall_curve(y, p)
    pd.DataFrame({"precision": precision, "recall": recall, "threshold": np.append(thresholds, np.nan)}).to_csv(OUT / f"{prefix}_pr.csv", index=False)
    fraction_positive, mean_predicted = calibration_curve(y, p, n_bins=10, strategy="quantile")
    pd.DataFrame({"mean_predicted_probability": mean_predicted, "observed_churn_rate": fraction_positive}).to_csv(OUT / f"{prefix}_calibration.csv", index=False)


def bootstrap_metrics(y, p, repetitions=400):
    """Uncertainty on untouched test ranking; no model selection or threshold tuning."""
    y, p = np.asarray(y), np.asarray(p)
    rng = np.random.default_rng(RANDOM_STATE)
    result = []
    for _ in range(repetitions):
        idx = rng.integers(0, len(y), len(y))
        top = targeting_table(y[idx], p[idx], fractions=(.1,)).iloc[0]
        result.append([roc_auc_score(y[idx], p[idx]), average_precision_score(y[idx], p[idx]), top.precision, top.capture_recall, top.lift])
    samples = np.asarray(result)
    return {name: {"lower_95": np.quantile(samples[:, i], .025), "upper_95": np.quantile(samples[:, i], .975)} for i, name in enumerate(["roc_auc", "pr_auc_average_precision", "precision_top10", "capture_top10", "lift_top10"])}


def acquire():
    """Use the user's official loader and preserve its unprocessed cached source."""
    from empulse.datasets import fetch_cell2cell
    from empulse.datasets._remote import _CELL2CELL_URL
    from empulse.datasets._process import process_cell2cell, _snake_case_column_name
    cache_home = DATA / "empulse_cache"
    dataset = fetch_cell2cell(backend=pd, data_home=cache_home)
    cache = cache_home / "cell2cell.csv.gz"
    raw = pd.read_csv(cache)
    raw.to_csv(DATA / "cell2cell_raw.csv", index=False)
    features, target = dataset.data.reset_index(drop=True), dataset.target.reset_index(drop=True)
    features.to_csv(DATA / "cell2cell_features.csv", index=False)
    pd.DataFrame({TARGET: target}).to_csv(DATA / "cell2cell_target.csv", index=False)
    # Preserve the official native matrix above, while restoring the upstream column
    # labels in the project analysis table through a verified one-to-one name map.
    source_name_map = {_snake_case_column_name(c): c for c in raw.columns}
    if any(c not in source_name_map for c in features.columns):
        raise ValueError("The loader returned a feature without a source-column name match.")
    features = features.rename(columns=source_name_map)
    retained = raw.loc[pd.to_numeric(raw["MonthlyRevenue"], errors="coerce").notna()].reset_index(drop=True)
    if len(retained) != len(features):
        raise ValueError("Cannot restore CustomerID: loader row count differs from MonthlyRevenue filter.")
    mapped_target = retained[TARGET].astype(str).str.lower().map({"yes": 1, "no": 0, "1": 1, "0": 0})
    np.testing.assert_array_equal(mapped_target.to_numpy(), np.asarray(target))
    for col in ["MonthlyRevenue", "MonthsInService", "MonthlyMinutes"]:
        if col in features:
            np.testing.assert_allclose(pd.to_numeric(retained[col], errors="coerce"), pd.to_numeric(features[col], errors="coerce"), equal_nan=True)
    frame = features.copy()
    frame.insert(0, ID, retained[ID].to_numpy())
    frame[TARGET] = np.asarray(target, dtype=int)
    frame.to_csv(DATA / "cell2cell_analysis.csv", index=False)
    raw_missing = raw.isna().sum().sort_values(ascending=False)
    clean_missing = frame.isna().sum().sort_values(ascending=False)
    pd.DataFrame({"feature": raw_missing.index, "missing_count": raw_missing.values, "missing_fraction": raw_missing.values / len(raw)}).to_csv(OUT / "raw_missing.csv", index=False)
    pd.DataFrame({"feature": clean_missing.index, "missing_count": clean_missing.values, "missing_fraction": clean_missing.values / len(frame)}).to_csv(OUT / "analysis_missing.csv", index=False)
    audit = {
        "source_url": _CELL2CELL_URL, "raw_file": "data/cell2cell_raw.csv", "analysis_file": "data/cell2cell_analysis.csv",
        "raw_rows": len(raw), "raw_columns": raw.shape[1], "loader_rows": len(frame), "loader_feature_count": features.shape[1],
        "analysis_columns_with_id_and_target": frame.shape[1], "raw_target_counts": raw[TARGET].value_counts().to_dict(),
        "churn_count": int(frame[TARGET].sum()), "churn_rate": float(frame[TARGET].mean()),
        "raw_duplicate_rows": int(raw.duplicated().sum()), "raw_duplicate_id": int(raw[ID].duplicated().sum()),
        "analysis_duplicate_rows": int(frame.duplicated().sum()), "analysis_duplicate_id": int(frame[ID].duplicated().sum()),
        "rows_removed_missing_monthly_revenue": len(raw) - len(frame),
        "removed_churn_count": int(raw.loc[raw["MonthlyRevenue"].isna(), TARGET].eq("Yes").sum()),
        "raw_sha256": hashlib.sha256((DATA / "cell2cell_raw.csv").read_bytes()).hexdigest(),
        "source_cache_sha256": hashlib.sha256(cache.read_bytes()).hexdigest(),
        "source_cache_file": "data/empulse_cache/cell2cell.csv.gz",
        "analysis_sha256": hashlib.sha256((DATA / "cell2cell_analysis.csv").read_bytes()).hexdigest(),
        "loader_description": dataset.DESCR,
        "loader_column_name_mapping": {c: source_name_map[c] for c in dataset.data.columns},
        "loader_transformations": "Removes rows without MonthlyRevenue; maps Churn to 0/1; removes CustomerID from predictors; converts feature names to snake_case; converts numeric fields and null tokens. Project analysis table restores source column names with verified one-to-one mapping and CustomerID by retained row order.",
        "currency_and_observation_date": "Currency and observation dates/horizon are not supplied; do not label values VND or current monthly churn.",
        "cost_defaults_used": False,
    }
    write_json(OUT / "data_manifest.json", audit)
    schema = pd.DataFrame({"feature": frame.columns, "dtype": [str(frame[c].dtype) for c in frame], "unique_count": [frame[c].nunique(dropna=True) for c in frame], "missing_count": frame.isna().sum().values})
    schema.to_csv(OUT / "schema.csv", index=False)
    (OUT / "empulse_loader_description.txt").write_text(dataset.DESCR, encoding="utf-8")
    (OUT / "empulse_loader_processing_source.py").write_text(inspect.getsource(process_cell2cell), encoding="utf-8")
    return frame, audit


def run():
    DATA.mkdir(exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    started = time.time()
    print("Acquiring and auditing the official Cell2Cell loader output...", flush=True)
    frame, data_audit = acquire()
    print(json.dumps({k: data_audit[k] for k in ["raw_rows", "loader_rows", "loader_feature_count", "churn_count", "churn_rate"]}), flush=True)
    x, definitions = feature_engineering(frame)
    if any("retention" in c.lower() for c in x):
        raise AssertionError("A retention variable survived early-warning feature exclusion.")
    if ID in x or "ServiceArea" in x or TARGET in x:
        raise AssertionError("Identifier or target survived early-warning feature exclusion.")
    y = frame[TARGET]
    train_val_idx, test_idx = train_test_split(np.arange(len(frame)), test_size=.2, stratify=y, random_state=RANDOM_STATE)
    train_idx, val_idx = train_test_split(train_val_idx, test_size=.25, stratify=y.iloc[train_val_idx], random_state=RANDOM_STATE)
    split = np.full(len(frame), "train", dtype=object)
    split[val_idx], split[test_idx] = "validation", "test"
    pd.DataFrame({"row_index": np.arange(len(frame)), "customer_id": frame[ID], "split": split, "observed_churn": y}).to_csv(OUT / "data_splits.csv", index=False)
    models, numeric, categorical = model_candidates(x)
    model_rows, val_predictions, fit_seconds = [], {}, {}
    for name, model in models.items():
        print(f"Training {name} on {len(train_idx):,} train rows...", flush=True)
        start = time.time()
        model.fit(x.iloc[train_idx], y.iloc[train_idx])
        fit_seconds[name] = time.time() - start
        probability = model.predict_proba(x.iloc[val_idx])[:, 1]
        val_predictions[name] = probability
        ranking = targeting_table(y.iloc[val_idx], probability).set_index("capacity")
        model_rows.append({"model": name, "split": "validation", **metric_row(y.iloc[val_idx], probability), "precision_top10": ranking.loc[.1, "precision"], "capture_top20": ranking.loc[.2, "capture_recall"], "lift_top10": ranking.loc[.1, "lift"], "fit_seconds": fit_seconds[name]})
        curve_tables(y.iloc[val_idx], probability, "validation_" + name.lower().replace(" ", "_"))
    comparison = pd.DataFrame(model_rows).sort_values(["pr_auc_average_precision", "lift_top10"], ascending=False)
    selected_name = comparison.iloc[0]["model"]
    selected_model = models[selected_name]
    selected_probability = val_predictions[selected_name]
    calibration_decision = "No external calibration: validation Brier score did not justify added complexity."
    # Evaluate calibration using only train CV fits and validation; the test remains unseen.
    print(f"Selected ranking candidate: {selected_name}; checking train-only sigmoid calibration...", flush=True)
    calibrated = CalibratedClassifierCV(estimator=clone(selected_model), method="sigmoid", cv=StratifiedKFold(n_splits=3, shuffle=True, random_state=RANDOM_STATE), n_jobs=1, ensemble=False)
    calibrated.fit(x.iloc[train_idx], y.iloc[train_idx])
    calibrated_p = calibrated.predict_proba(x.iloc[val_idx])[:, 1]
    before_brier = brier_score_loss(y.iloc[val_idx], selected_probability)
    after_brier = brier_score_loss(y.iloc[val_idx], calibrated_p)
    # A monotone sigmoid should retain ranking; require no material ranking degradation.
    use_calibration = after_brier < before_brier - .0005 and average_precision_score(y.iloc[val_idx], calibrated_p) >= average_precision_score(y.iloc[val_idx], selected_probability) - .002
    if use_calibration:
        selected_model = calibrated
        selected_probability = calibrated_p
        calibration_decision = "Sigmoid calibration adopted: train-only 3-fold calibration improved validation Brier by more than 0.0005 without material AP loss."
    comparison.to_csv(OUT / "model_comparison_validation.csv", index=False)
    thresholds = np.unique(np.r_[np.arange(.05, .81, .025), np.quantile(selected_probability, [.7, .8, .9, .95])])
    threshold_table = pd.DataFrame([metric_row(y.iloc[val_idx], selected_probability, threshold=t) for t in thresholds])
    threshold_table.to_csv(OUT / "threshold_analysis_validation.csv", index=False)
    val_targeting = targeting_table(y.iloc[val_idx], selected_probability)
    val_targeting.to_csv(OUT / "targeting_validation.csv", index=False)
    # The business has not specified capacity; 20% is an explicit planning scenario, not an observed constraint.
    threshold = float(val_targeting.set_index("capacity").loc[.2, "minimum_score"])
    risk_boundaries = {"medium": float(np.quantile(selected_probability, .5)), "high": float(np.quantile(selected_probability, .8)), "very_high": float(np.quantile(selected_probability, .9))}
    print("Model and validation threshold frozen; evaluating the held-out test once...", flush=True)
    test_p = selected_model.predict_proba(x.iloc[test_idx])[:, 1]
    test_metrics = metric_row(y.iloc[test_idx], test_p, threshold)
    test_targeting = targeting_table(y.iloc[test_idx], test_p)
    test_targeting.to_csv(OUT / "targeting_test.csv", index=False)
    decile_table(y.iloc[test_idx], test_p).to_csv(OUT / "deciles_test.csv", index=False)
    curve_tables(y.iloc[test_idx], test_p, "test_selected")
    test_bootstrap = bootstrap_metrics(y.iloc[test_idx], test_p)
    pd.DataFrame({"customer_id": frame.iloc[test_idx][ID], "observed_churn": y.iloc[test_idx], "churn_probability": test_p, "predicted_churn_at_validation_threshold": (test_p >= threshold).astype(int)}).to_csv(OUT / "predictions_test.csv", index=False)
    pd.DataFrame({"customer_id": frame.iloc[val_idx][ID], "observed_churn": y.iloc[val_idx], "churn_probability": selected_probability}).to_csv(OUT / "predictions_validation.csv", index=False)
    joblib.dump(selected_model, OUT / "evaluation_model.joblib")
    print("Computing held-out permutation importance and logistic coefficient directions...", flush=True)
    importance = permutation_importance(selected_model, x.iloc[test_idx], y.iloc[test_idx], scoring="average_precision", n_repeats=4, random_state=RANDOM_STATE, n_jobs=1)
    pd.DataFrame({"feature": x.columns, "importance_mean_pr_auc_decrease": importance.importances_mean, "importance_std": importance.importances_std}).sort_values("importance_mean_pr_auc_decrease", ascending=False).to_csv(OUT / "permutation_importance_test.csv", index=False)
    logistic = models["Logistic Regression"]
    coeffs = pd.DataFrame({"encoded_feature": logistic.named_steps["preprocess"].get_feature_names_out(), "coefficient": logistic.named_steps["model"].coef_[0]})
    coeffs["odds_ratio"] = np.exp(coeffs["coefficient"].clip(-700, 700))
    coeffs["absolute_coefficient"] = coeffs.coefficient.abs()
    coeffs.sort_values("absolute_coefficient", ascending=False).to_csv(OUT / "logistic_coefficients.csv", index=False)
    # Cross-fit fixed selected specification across every historical customer. These scores
    # are never substituted for the previously untouched final-test benchmark.
    print("Creating five-fold out-of-fold historical scores for every customer...", flush=True)
    oof = np.full(len(frame), np.nan)
    oof_fold = np.full(len(frame), -1)
    for fold, (fit_idx, score_idx) in enumerate(StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE).split(x, y), 1):
        print(f"Historical scoring fold {fold}/5...", flush=True)
        estimator = clone(selected_model)
        estimator.fit(x.iloc[fit_idx], y.iloc[fit_idx])
        oof[score_idx] = estimator.predict_proba(x.iloc[score_idx])[:, 1]
        oof_fold[score_idx] = fold
    if np.isnan(oof).any():
        raise AssertionError("Missing OOF score")
    historical = pd.DataFrame({"customer_id": frame[ID], "observed_churn": y, "churn_probability": oof, "score_basis": "out_of_fold_historical", "score_fold": oof_fold, "benchmark_split": split})
    for col in ["MonthlyRevenue", "MonthlyMinutes", "MonthsInService", "PercChangeMinutes", "PercChangeRevenues", "DroppedCalls", "BlockedCalls", "CustomerCareCalls", "CurrentEquipmentDays"]:
        if col in frame:
            historical[col] = frame[col]
    historical.to_csv(OUT / "predictions_historical_oof.csv", index=False)
    print("Fitting production artifact on the complete historical cohort after benchmark closure...", flush=True)
    production = clone(selected_model).fit(x, y)
    joblib.dump(production, OUT / "production_model.joblib")
    summary = {
        "random_state": RANDOM_STATE, "split_method": "Stratified random 60/20/20; no reliable snapshot date exists for temporal backtest.",
        "splits": {s: {"n": int((split == s).sum()), "churn_count": int(y[split == s].sum()), "churn_rate": float(y[split == s].mean())} for s in ["train", "validation", "test"]},
        "selection_criterion": "Validation average precision, then top10% lift. Accuracy is descriptive only.", "selected_model": selected_name,
        "calibrated": use_calibration, "calibration_decision": calibration_decision, "validation_brier_before": before_brier, "validation_brier_after_sigmoid": after_brier,
        "validation_selected": metric_row(y.iloc[val_idx], selected_probability, threshold), "test": test_metrics, "test_bootstrap_95_ci": test_bootstrap,
        "test_bootstrap_note": "400 ordinary resamples of the held-out test, conditional on this fitted model; does not include retraining or future distribution-shift uncertainty.",
        "capacity_scenario": .2, "capacity_status": "Planning scenario only: actual operational capacity and contact/offer costs not supplied.",
        "selected_threshold_validation": threshold, "risk_boundaries_validation_quantiles": risk_boundaries,
        "high_value_threshold_train_median": float(frame.iloc[train_idx]["MonthlyRevenue"].median()),
        "signal_thresholds_train": {c: {"q25": float(frame.iloc[train_idx][c].quantile(.25)), "median": float(frame.iloc[train_idx][c].median()), "q75": float(frame.iloc[train_idx][c].quantile(.75))} for c in ["MonthlyRevenue", "MonthsInService", "PercChangeMinutes", "PercChangeRevenues", "DroppedBlockedCalls", "CustomerCareCalls", "CurrentEquipmentDays"] if c in frame},
        "excluded_identifiers": [c for c in EXCLUDED_IDENTIFIERS if c in frame], "excluded_potential_leakage": [c for c in RETENTION if c in frame],
        "identifier_rationale": "CustomerID is a row identifier. ServiceArea is a high-cardinality local service code with unknown timing/geographic semantics; excluded conservatively and retained for descriptive audits.",
        "leakage_rationale": "Retention interactions may occur after churn signals/escalation; no reliable timestamps establish pre-intervention availability.",
        "numeric_features": numeric, "categorical_features": categorical, "model_feature_count": len(x.columns), "feature_engineering": definitions,
        "missing_policy": "AgeHH1/AgeHH2 zero -> missing; IncomeGroup zero -> Unknown and remaining codes categorical; HandsetPrice parsed numeric with Unknown -> missing. Numeric median plus missing indicator; categorical Unknown. All imputation/scaling/encoding fitted within each training partition.",
        "outlier_policy": "Extreme observations retained; no automatic deletion or winsorization. Negative MonthlyRevenue retained as possible account credits. Small negative CurrentEquipmentDays retained and flagged for source verification because effective-date/offset semantics are undocumented.",
        "historical_score_caveat": "OOF historical scores exclude each customer's own label during fitting but model specification was selected on historical validation. Use untouched test metrics as the sole final performance estimate. These already-observed labels are not a live future campaign list.",
        "production_artifact": "production_model.joblib: refitted on full historical cohort after evaluation; fit engineered columns with feature_engineering().",
        "versions": {pkg: importlib.metadata.version(pkg) for pkg in ["pandas", "numpy", "scikit-learn", "empulse", "joblib"]},
        "runtime_seconds": time.time() - started,
    }
    write_json(OUT / "model_summary.json", summary)
    print(json.dumps(native({"selected_model": selected_name, "calibrated": use_calibration, "test": test_metrics, "runtime_seconds": time.time() - started}), ensure_ascii=False), flush=True)


if __name__ == "__main__":
    with threadpool_limits(limits=4):
        run()
