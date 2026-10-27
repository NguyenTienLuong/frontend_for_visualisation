def process_cell2cell(
    raw: dict[str, list[Any]],
    backend: Any,
) -> tuple[nw.DataFrame[Any], nw.Series[Any], FloatNDArray]:
    """Process the Cell2Cell Customer Churn raw dict.

    Parameters
    ----------
    raw : dict
        Column-oriented dict of raw string values (from cache or remote).
    backend : module
        Narwhals-compatible dataframe backend.

    Returns
    -------
    feature_df : narwhals DataFrame
    target_series : narwhals Series (name='churn', dtype Int8)
    monthly_revenue : numpy array
    """
    df = nw.from_dict(raw, backend=backend)

    # Drop the 156 rows (0.31%) without MonthlyRevenue.
    rev_col = _find_column(dict.fromkeys(df.columns), ('MonthlyRevenue', 'monthly_revenue', 'monthlyrevenue'))
    df = df.filter(~nw.col(rev_col).is_null() & ~nw.col(rev_col).is_in(['', 'NA', '?', 'None']))

    target_col = _find_column(dict.fromkeys(df.columns), ('Churn', 'churn', 'target', 'class'))
    target_series = df.select(
        nw
        .when(nw.col(target_col).is_in(['1', '1.0', 'Yes', 'yes', 'True', 'true']))
        .then(nw.lit(1))
        .otherwise(nw.lit(0))
        .cast(nw.Int8)
        .alias('churn')
    )['churn']

    monthly_revenue: FloatNDArray = df[rev_col].cast(nw.Float64).to_numpy()

    id_cols = {'CustomerID', 'customerid', 'customer_id'}
    feature_cols = [c for c in df.columns if c != target_col and c not in id_cols]

    categorical_cols = {
        _snake_case_column_name(col)
        for col in (
            'ServiceArea',
            'ChildrenInHH',
            'HandsetRefurbished',
            'HandsetWebCapable',
            'TruckOwner',
            'RVOwner',
            'Homeownership',
            'BuysViaMailOrder',
            'RespondsToMailOffers',
            'OptOutMailings',
            'NonUSTravel',
            'OwnsComputer',
            'HasCreditCard',
            'NewCellphoneUser',
            'NotNewCellphoneUser',
            'OwnsMotorcycle',
            'HandsetPrice',
            'MadeCallToRetentionTeam',
            'CreditRating',
            'PrizmCode',
            'Occupation',
            'MaritalStatus',
        )
    }

    feat = df.select([
        nw
        .when(nw.col(c).is_in(['?', 'NA', '', 'None', 'null']) | nw.col(c).is_null())
        .then(nw.lit(None))
        .otherwise(nw.col(c))
        .alias(_snake_case_column_name(c))
        if _snake_case_column_name(c) in categorical_cols
        else (
            nw
            .when(nw.col(c).is_in(['?', 'NA', '', 'None', 'null', 'Unknown']) | nw.col(c).is_null())
            .then(nw.lit(None))
            .otherwise(nw.col(c))
            .cast(nw.Float64)
            .alias(_snake_case_column_name(c))
        )
        for c in feature_cols
    ])

    return feat, target_series, monthly_revenue
