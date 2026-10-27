"""Cell2Cell EDA, auditable business tables, static charts and interactive explorers.

All reported facts are computed from cell2cell_analysis.csv; raw-file quality is
audited separately so cohort selection cannot silently change the denominator.
Run: .venv/Scripts/python.exe src/eda_visuals.py
"""
from __future__ import annotations

import argparse
import json
import math
import os
import textwrap
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", str(Path(__file__).resolve().parents[1] / "output" / ".matplotlib"))
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import PercentFormatter, FuncFormatter
from matplotlib.colors import LinearSegmentedColormap
import numpy as np
import pandas as pd
from scipy.stats import mannwhitneyu, chi2_contingency

BASE = Path(__file__).resolve().parents[1]
DATA = BASE / "data"
OUT = BASE / "output" / "analysis"
CHARTS = BASE / "output" / "charts"
INTERACTIVE = BASE / "output" / "interactive"
ORANGE = "#D66A35"
GREY = "#A8AFB6"
DARK = "#263747"
LIGHT = "#EDF0F2"
RANDOM_STATE = 42
TARGET = "Churn"
META = []

LABELS = {
    "MonthsInService": "Thời gian gắn bó (tháng)",
    "MonthlyRevenue": "Doanh thu hàng tháng (đơn vị dữ liệu)",
    "TotalRecurringCharge": "Phí định kỳ (đơn vị dữ liệu)",
    "MonthlyMinutes": "Phút sử dụng hàng tháng",
    "PercChangeMinutes": "Chỉ số thay đổi phút sử dụng",
    "PercChangeRevenues": "Chỉ số thay đổi doanh thu",
    "OverageMinutes": "Phút vượt hạn mức",
    "RoamingCalls": "Chỉ số roaming",
    "DroppedCalls": "Cuộc gọi bị rớt",
    "BlockedCalls": "Cuộc gọi bị chặn",
    "UnansweredCalls": "Cuộc gọi không được trả lời",
    "CustomerCareCalls": "Cuộc gọi tới Customer Care",
    "CurrentEquipmentDays": "Tuổi thiết bị hiện tại (ngày)",
    "Handsets": "Số thiết bị", "HandsetModels": "Số mẫu thiết bị",
    "ActiveSubs": "Số thuê bao đang hoạt động", "UniqueSubs": "Số thuê bao duy nhất",
    "CreditRating": "Xếp hạng tín dụng", "AgeHH1": "Tuổi chủ hộ thứ nhất",
    "IncomeGroup": "Nhóm thu nhập mã hóa", "Occupation": "Nghề nghiệp",
    "MaritalStatus": "Tình trạng hôn nhân",
    "RetentionCalls": "Số cuộc gọi retention",
    "RetentionOffersAccepted": "Số offer retention được chấp nhận",
    "MadeCallToRetentionTeam": "Đã gọi tới retention team",
    "HandsetPrice": "Mức giá thiết bị (mã dữ liệu)",
    "HandsetRefurbished": "Thiết bị tân trang",
    "HandsetWebCapable": "Thiết bị có khả năng truy cập web",
}

DESCRIPTIONS = {
    "CustomerID": "Mã khách hàng trong nguồn; chỉ dùng đối soát và xuất danh sách, không dùng làm predictor.",
    "Churn": "Nhãn rời bỏ dịch vụ do nguồn cung cấp; 1 là churn, 0 là duy trì.",
    "MonthlyRevenue": "Doanh thu hàng tháng theo đơn vị nguồn; chưa xác nhận đơn vị tiền tệ và cửa sổ quan sát.",
    "MonthlyMinutes": "Thời lượng sử dụng hàng tháng theo nguồn, đơn vị phút.",
    "TotalRecurringCharge": "Khoản phí định kỳ theo nguồn, cùng đơn vị tiền tệ chưa được xác nhận.",
    "MonthsInService": "Thời gian khách hàng đã sử dụng dịch vụ, đơn vị tháng.",
    "PercChangeMinutes": "Chỉ số thay đổi phút sử dụng do nguồn cung cấp; không diễn giải là phần trăm khi chưa xác minh công thức.",
    "PercChangeRevenues": "Chỉ số thay đổi doanh thu do nguồn cung cấp; không diễn giải là phần trăm khi chưa xác minh công thức.",
    "CurrentEquipmentDays": "Số ngày sử dụng thiết bị hiện tại theo nguồn.",
    "AgeHH1": "Tuổi thành viên/chủ hộ thứ nhất; 0 được đánh dấu không rõ tuổi cho EDA, cần xác minh với chủ dữ liệu.",
    "AgeHH2": "Tuổi thành viên/chủ hộ thứ hai; 0 được đánh dấu không rõ tuổi cho EDA, cần xác minh với chủ dữ liệu.",
    "IncomeGroup": "Mã nhóm thu nhập; không giả định đây là thu nhập tiền tệ liên tục.",
    "ServiceArea": "Mã vùng phục vụ; có tính chất định danh khu vực, không diễn giải là số đo liên tục.",
    "RetentionCalls": "Số cuộc gọi liên quan retention; chỉ mô tả, chưa xác nhận thời điểm sẵn có trước quyết định can thiệp.",
    "RetentionOffersAccepted": "Số offer giữ chân được chấp nhận; chỉ mô tả, có nguy cơ leakage theo thời gian.",
    "MadeCallToRetentionTeam": "Cờ từng gọi tới đội retention; chỉ mô tả, có nguy cơ leakage theo thời gian.",
}


def native(value):
    if isinstance(value, dict):
        return {str(k): native(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, np.ndarray)):
        return [native(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        return None if not np.isfinite(value) else float(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if isinstance(value, Path):
        return str(value)
    return value


def write_json(path, value):
    path.write_text(json.dumps(native(value), ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")


def pct(x):
    return f"{x:.1%}"


def num(x):
    if pd.isna(x):
        return "thiếu"
    if abs(x) >= 1000:
        return f"{x:,.0f}"
    return f"{x:.1f}".rstrip("0").rstrip(".")


def find_col(df, *candidates):
    normalize = lambda x: "".join(ch for ch in str(x).lower() if ch.isalnum())
    lookup = {normalize(c): c for c in df}
    for name in candidates:
        if normalize(name) in lookup:
            return lookup[normalize(name)]
    return None


def identify_group(col):
    low = col.lower()
    if low == "churn": return "Target"
    if "retention" in low: return "Retention process — descriptive only"
    if low in ["customerid", "servicearea"]: return "Identifier / geography"
    if any(x in low for x in ["revenue", "recurring", "overage", "roaming"]): return "Revenue and charges"
    if any(x in low for x in ["dropped", "blocked", "care", "unanswered"]): return "Service experience"
    if any(x in low for x in ["handset", "equipment"]): return "Devices"
    if any(x in low for x in ["months", "subs"]): return "Customer relationship"
    if any(x in low for x in ["minutes", "calls", "threeway", "peak"]): return "Usage and calling"
    return "Customer profile and credit"


def wilson(k, n, z=1.959963984540054):
    if not n:
        return (np.nan, np.nan)
    p = k / n
    center = (p + z*z/(2*n)) / (1+z*z/n)
    half = z * math.sqrt(p*(1-p)/n + z*z/(4*n*n)) / (1+z*z/n)
    return center-half, center+half


def make_groups(series, max_groups=5, age=False):
    """Ordered, distribution-based bins. Never imply an external business threshold."""
    s = series.copy()
    if age and pd.api.types.is_numeric_dtype(s):
        s = s.mask(s <= 0)
    if pd.api.types.is_numeric_dtype(s) and s.nunique(dropna=True) > 8:
        nonmissing = s.dropna()
        if not len(nonmissing):
            return pd.Series("Thiếu / chưa rõ", index=s.index), {}
        if nonmissing.min() >= 0 and (nonmissing == 0).mean() >= .25:
            positive = nonmissing[nonmissing > 0]
            result = pd.Series("0", index=s.index, dtype=object)
            edges = np.unique(np.quantile(positive, [0, 1/3, 2/3, 1])) if len(positive) else np.array([])
            if len(edges) > 1:
                labels = [f">{num(edges[i])}–{num(edges[i+1])}" for i in range(len(edges)-1)]
                labels[0] = f">0–{num(edges[1])}"
                result.loc[positive.index] = pd.cut(positive, edges, labels=labels, include_lowest=True).astype(str)
                order = ["0", *labels]
            else:
                result.loc[positive.index] = ">0"
                order = ["0", ">0"]
        else:
            edges = np.unique(np.quantile(nonmissing, [0, .25, .5, .75, 1]))
            if len(edges) < 2:
                result = s.astype(str)
                order = list(result.drop_duplicates())
            else:
                labels = [f"{num(edges[i])}–{num(edges[i+1])}" for i in range(len(edges)-1)]
                result = pd.cut(s, edges, labels=labels, include_lowest=True).astype(object)
                order = labels
        result.loc[s.isna()] = "Thiếu / chưa rõ"
        if s.isna().any(): order = [*order, "Thiếu / chưa rõ"]
        return pd.Series(pd.Categorical(result, categories=order, ordered=True), index=s.index), {"method": "distribution_based", "edges": edges.tolist()}
    clean = s.astype(object).where(s.notna(), "Thiếu / chưa rõ").astype(str)
    counts = clean.value_counts()
    if len(counts) > max_groups+3:
        keep = counts.head(max_groups+1).index
        clean = clean.where(clean.isin(keep), "Khác (gộp nhóm nhỏ)")
    if pd.api.types.is_numeric_dtype(s):
        order = sorted(clean.unique(), key=lambda v: float(v) if v not in ["Thiếu / chưa rõ", "Khác (gộp nhóm nhỏ)"] else float("inf"))
    else:
        order = clean.value_counts().index.tolist()
    return pd.Series(pd.Categorical(clean, categories=order, ordered=True), index=s.index), {"method": "observed_categories", "order": order}


def rate_table(groups, y):
    temp = pd.DataFrame({"group": groups, "churn": y})
    table = temp.groupby("group", observed=True, sort=True)["churn"].agg(n="size", churn_count="sum").reset_index()
    table["group"] = table["group"].astype(str)
    table["churn_rate"] = table.churn_count/table.n
    intervals = [wilson(k,n) for k,n in zip(table.churn_count,table.n)]
    table["ci_low"] = [a for a,b in intervals]
    table["ci_high"] = [b for a,b in intervals]
    table["small_group"] = table.n < 100
    return table


def setup_style():
    plt.rcParams.update({
        "font.family": "DejaVu Sans", "font.size": 10,
        "axes.titlesize": 15, "axes.titleweight": "bold", "axes.labelsize": 10,
        "axes.edgecolor": LIGHT, "axes.labelcolor": DARK, "text.color": DARK,
        "xtick.color": DARK, "ytick.color": DARK,
        "axes.spines.top": False, "axes.spines.right": False,
        "figure.facecolor": "white", "axes.facecolor": "white",
        "savefig.facecolor": "white", "grid.alpha": .25,
    })


def finish(fig, ax, chart_id, title, insight, meaning, next_q, section, question, decision, report=True, **extra):
    fig.suptitle(textwrap.fill(title,width=91), x=.06, ha="left", y=.975, fontsize=14, fontweight="bold")
    fig.text(.06,.025,"Cell2Cell | Mô tả quan hệ quan sát; chưa suy ra tác động nhân quả.",fontsize=8,color="#64717D")
    fig.subplots_adjust(top=.79,bottom=.17,left=.12,right=.94)
    sequential_id = f"E{len(META)+1:02d}"
    path = CHARTS / f"{sequential_id}_{chart_id}.png"
    fig.savefig(path,dpi=170,bbox_inches="tight")
    plt.close(fig)
    item = dict(id=sequential_id,slug=chart_id,path=str(path),title=title,insight=insight,business_meaning=meaning,next_question=next_q,section=section,question=question,decision=decision,report=report,**extra)
    META.append(item)
    return item


def rate_chart(df, col, analyses, section="5", report=False):
    groups, bins = make_groups(df[col], age=col in ["AgeHH1","AgeHH2"])
    t = rate_table(groups,df[TARGET])
    eligible = t[t.n>=100]
    top = (eligible if len(eligible) else t).sort_values("churn_rate",ascending=False).iloc[0]
    bottom = (eligible if len(eligible) else t).sort_values("churn_rate").iloc[0]
    overall=df[TARGET].mean()
    label=LABELS.get(col,col)
    title=f"{label}: nhóm {top['group']} ghi nhận churn {pct(top.churn_rate)}"
    insight=f"Nhóm {top['group']} có {int(top.n):,} khách hàng, {int(top.churn_count):,} churn, tỷ lệ {pct(top.churn_rate)} (CI 95% {pct(top.ci_low)}–{pct(top.ci_high)}). Nhóm {bottom['group']} ghi nhận {pct(bottom.churn_rate)}; chênh lệch quan sát {(top.churn_rate-bottom.churn_rate)*100:.1f} điểm phần trăm."
    retention="Retention" in col or "retention" in col.lower()
    meaning=("Đây là mô tả luồng xử lý giữ chân. Khách hàng được chuyển tới retention có thể đã có nguy cơ cao; kết quả không đo hiệu quả của offer và trường này bị loại khỏi mô hình cảnh báo sớm." if retention else f"Có thể dùng {label.lower()} để bổ sung phân nhóm kiểm tra vận hành, kết hợp quy mô nhóm, giá trị và các tín hiệu khác; một biến riêng lẻ chưa đủ để quyết định can thiệp.")
    nextq=("Cần lưu thời điểm tiếp xúc, phân nhóm ngẫu nhiên treatment/control và đo incremental retention." if retention else "Khác biệt còn tồn tại khi kiểm soát thời gian gắn bó, giá trị và cường độ sử dụng hay không?")
    fig,ax=plt.subplots(figsize=(9.2,4.7))
    # Keep rare groups in the auditable table; avoid allowing a single customer's
    # wide CI to determine the visual scale of a 50k-customer business comparison.
    shown=t[t.n>=100].copy() if (t.n>=100).any() else t.copy()
    shown=shown.reset_index(drop=True)
    omitted=t[~t.group.isin(shown.group)]
    pos=np.arange(len(shown))
    colors=[ORANGE if g==top['group'] else GREY for g in shown.group]
    ax.bar(pos,shown.churn_rate,color=colors,width=.66)
    ax.errorbar(pos,shown.churn_rate,yerr=[shown.churn_rate-shown.ci_low,shown.ci_high-shown.churn_rate],fmt="none",ecolor=DARK,elinewidth=1,capsize=3)
    ax.axhline(overall,color="#6D7882",ls="--",lw=1,label=f"Toàn cohort: {pct(overall)}")
    ax.set_xticks(pos,[f"{g}\nn={n:,}" for g,n in zip(shown.group,shown.n)],rotation=0 if len(shown)<=5 else 22,ha="center")
    ax.set_ylabel("Tỷ lệ churn (CI Wilson 95%)")
    ax.yaxis.set_major_formatter(PercentFormatter(1))
    ax.set_ylim(0,min(1,max(shown.ci_high.max()*1.22,overall*1.3)))
    ax.legend(frameon=False,fontsize=9,loc="upper right")
    for i,row in shown.iterrows(): ax.text(i,row.ci_high+.012,pct(row.churn_rate),ha="center",fontsize=9)
    if len(omitted):
        ax.text(0,1.04,f"{len(omitted)} nhóm n<100 ({int(omitted.n.sum()):,} khách hàng) lưu đầy đủ trong bảng CSV, không vẽ cột.",transform=ax.transAxes,fontsize=8,color="#64717D")
    ax.spines['left'].set_visible(False); ax.spines['bottom'].set_visible(False)
    path=OUT/f"churn_by_{col}.csv"; t.to_csv(path,index=False,encoding="utf-8-sig")
    by_target={}
    if pd.api.types.is_numeric_dtype(df[col]):
        for val,name in [(0,"non_churn"),(1,"churn")]:
            s=df.loc[df[TARGET]==val,col]
            by_target[name]={"n":int(s.notna().sum()),"mean":s.mean(),"median":s.median(),"q25":s.quantile(.25),"q75":s.quantile(.75)}
    analyses[col]={"label":label,"table":t.to_dict("records"),"binning":bins,"summary_by_target":by_target,"key_insight":insight,"business_meaning":meaning,"next_question":nextq,"table_path":str(path),"retention_descriptive_only":retention}
    finish(fig,ax,col,title,insight,meaning,nextq,section,f"{label} liên quan thế nào tới churn?","Dùng cùng các tín hiệu khác để xác định nhóm cần điều tra.",report)


def distribution_chart(df,col,chart_id,report=False):
    s=df[col].dropna(); qlow,qhigh=s.quantile([.01,.99])
    if qlow==qhigh: qlow,qhigh=s.min(),s.max()
    med=df.groupby(TARGET)[col].median()
    title=f"{LABELS.get(col,col)}: trung vị churn {num(med.get(1,np.nan))}, duy trì {num(med.get(0,np.nan))}"
    fig,ax=plt.subplots(figsize=(9.2,4.4))
    bins=np.linspace(qlow,qhigh,36)
    for y,color,name in [(0,GREY,"Duy trì"),(1,ORANGE,"Churn")]:
        vals=df.loc[df[TARGET]==y,col].dropna()
        # Weights use full nonmissing group denominator; visible tails are not silently renormalized.
        ax.hist(vals,bins=bins,weights=np.repeat(1/max(1,len(vals)),len(vals)),alpha=.62,color=color,label=name)
    ax.yaxis.set_major_formatter(PercentFormatter(1))
    ax.set_ylabel("Tỷ trọng trong từng nhóm")
    ax.set_xlabel(LABELS.get(col,col)); ax.legend(frameon=False)
    note=f"Trục X hiển thị P1–P99 [{num(qlow)}, {num(qhigh)}]; {((s<qlow)|(s>qhigh)).sum():,} quan sát ngoài khung vẫn giữ trong phân tích."
    ax.text(0,1.04,note,transform=ax.transAxes,fontsize=8,color="#64717D")
    insight=f"Trung vị {col} của nhóm churn là {num(med.get(1,np.nan))}, so với {num(med.get(0,np.nan))} ở nhóm duy trì. Phân phối có chồng lấn, vì vậy không xem đây là ngưỡng dự báo độc lập."
    finish(fig,ax,chart_id,title,insight,"So sánh phân phối giúp tránh suy luận chỉ dựa vào số trung bình và nhận diện khách hàng cực trị hợp lệ.","Churn rate thay đổi ra sao giữa các khoảng phân phối?","4",f"Phân phối {col} có khác giữa churn và duy trì?","Xác định khoảng đo phù hợp trước khi xây quy tắc.",report,display_range=[qlow,qhigh])


def interaction_chart(df,xcol,ycol,chart_id,report=False):
    gx,_=make_groups(df[xcol]); gy,_=make_groups(df[ycol])
    tmp=pd.DataFrame({"x":gx,"y":gy,"churn":df[TARGET]})
    tab=tmp.groupby(["y","x"],observed=True)["churn"].agg(n="size",churn_count="sum").reset_index()
    tab["churn_rate"]=tab.churn_count/tab.n
    for i,row in tab.iterrows():
        tab.loc[i,"ci_low"],tab.loc[i,"ci_high"]=wilson(row.churn_count,row.n)
    tab["small_group"]=tab.n<100
    nx=tab.groupby("x",observed=True).n.sum();ny=tab.groupby("y",observed=True).n.sum()
    orderx=[v for v in gx.cat.categories if nx.get(v,0)>=100];ordery=[v for v in gy.cat.categories if ny.get(v,0)>=100]
    if not orderx:orderx=list(gx.cat.categories)
    if not ordery:ordery=list(gy.cat.categories)
    matrix=tab.pivot(index="y",columns="x",values="churn_rate").reindex(index=ordery,columns=orderx)
    counts=tab.pivot(index="y",columns="x",values="n").reindex(index=ordery,columns=orderx)
    eligible=tab[tab.n>=100]
    top=(eligible if len(eligible) else tab).sort_values("churn_rate",ascending=False).iloc[0]
    title=f"{xcol} × {ycol}: nhóm n≥100 cao nhất đạt churn {pct(top.churn_rate)}"
    fig,ax=plt.subplots(figsize=(9.8,5.4))
    cmap=LinearSegmentedColormap.from_list("neutral_orange",["#F4F5F6","#F2D5C4",ORANGE,"#8B3F21"])
    im=ax.imshow(matrix.values,cmap=cmap,vmin=0,vmax=max(.45,tab.churn_rate.max()),aspect="auto")
    for r in range(matrix.shape[0]):
        for c in range(matrix.shape[1]):
            if pd.notna(matrix.iloc[r,c]):
                n=int(counts.iloc[r,c]); marker="*" if n<100 else ""
                ax.text(c,r,f"{pct(matrix.iloc[r,c])}\nn={n:,}{marker}",ha="center",va="center",fontsize=9,color="white" if matrix.iloc[r,c]>.4 else DARK)
    ax.set_xticks(range(len(orderx)),orderx,fontsize=9)
    ax.set_yticks(range(len(ordery)),ordery,fontsize=9)
    ax.set_xlabel(LABELS.get(xcol,xcol)); ax.set_ylabel(LABELS.get(ycol,ycol))
    cb=fig.colorbar(im,ax=ax,shrink=.75,pad=.02);cb.ax.yaxis.set_major_formatter(PercentFormatter(1))
    ax.text(0,1.03,"* n<100: diễn giải thận trọng; CI Wilson và số churn có trong bảng CSV.",transform=ax.transAxes,fontsize=8)
    insight=f"Nhóm {xcol}={top.x} và {ycol}={top.y} có {int(top.n):,} khách hàng; churn {pct(top.churn_rate)} (CI 95% {pct(top.ci_low)}–{pct(top.ci_high)}). Đây là tổ hợp quan sát, chưa xác nhận tương tác nhân quả."
    tab["x"]=tab.x.astype(str);tab["y"]=tab.y.astype(str)
    path=OUT/f"interaction_{chart_id}.csv";tab.to_csv(path,index=False,encoding="utf-8-sig")
    item=finish(fig,ax,chart_id,title,insight,"Kết hợp tín hiệu giúp định nghĩa nhóm cần điều tra cụ thể hơn. Khi triển khai, ngưỡng phải học từ tập train và kiểm tra trên cohort tương lai.","Mức chênh lệch có ổn định trong từng nhóm thời gian gắn bó và trên holdout?","6",f"Tổ hợp {xcol} và {ycol} bổ sung thông tin gì?","Ưu tiên kiểm tra các tổ hợp đủ quy mô trước khi thiết kế thử nghiệm.",report)
    return {"x":xcol,"y":ycol,"table":tab.to_dict("records"),"key_insight":insight,"table_path":str(path),"chart_id":chart_id}


def quality_audit(raw,df):
    missing=pd.DataFrame({"variable":raw.columns,"raw_missing":raw.isna().sum().values,"raw_missing_rate":raw.isna().mean().values})
    missing["analysis_missing"]=missing.variable.map(df.isna().sum()).fillna(0).astype(int)
    missing["analysis_missing_rate"]=missing.variable.map(df.isna().mean()).fillna(0)
    missing.to_csv(OUT/"missing_audit.csv",index=False,encoding="utf-8-sig")
    identifier=find_col(raw,"CustomerID","customer_id")
    outliers=[];validity=[]
    for col in df.select_dtypes(include=np.number):
        if col in [TARGET,identifier]:continue
        s=df[col].dropna()
        if not len(s):continue
        q1,q3=s.quantile([.25,.75]);iqr=q3-q1
        lo,hi=q1-1.5*iqr,q3+1.5*iqr
        outliers.append(dict(variable=col,n_nonmissing=len(s),minimum=s.min(),q1=q1,median=s.median(),q3=q3,maximum=s.max(),iqr_lower=lo,iqr_upper=hi,n_outside_iqr=int(((s<lo)|(s>hi)).sum()),outside_iqr_rate=((s<lo)|(s>hi)).mean(),action="Flag only; retain all observations"))
        if any(token in col.lower() for token in ["minutes","calls","months","days","subs","handsets"] ) and "change" not in col.lower():
            validity.append(dict(variable=col,n_negative=int((s<0).sum()),action="Investigate if negative; no automatic row deletion"))
    outliers=pd.DataFrame(outliers);outliers.to_csv(OUT/"outlier_audit.csv",index=False,encoding="utf-8-sig")
    pd.DataFrame(validity).to_csv(OUT/"validity_audit.csv",index=False,encoding="utf-8-sig")
    dictionary=[]
    for col in df:
        group=identify_group(col)
        desc=DESCRIPTIONS.get(col,LABELS.get(col,col)+" theo trường nguồn; cửa sổ tổng hợp và đơn vị chi tiết cần đối soát data owner.")
        role="Target" if col==TARGET else ("Excluded: identifier" if col==identifier or col=="ServiceArea" else ("Descriptive only; excluded early-warning model" if "Retention" in col else "EDA and candidate early-warning predictor; availability to be confirmed"))
        dictionary.append(dict(variable=col,dtype=str(df[col].dtype),group=group,meaning=desc,analysis_role=role,n_unique=int(df[col].nunique(dropna=True)),missing=int(df[col].isna().sum())))
    pd.DataFrame(dictionary).to_csv(OUT/"data_dictionary.csv",index=False,encoding="utf-8-sig")
    df.describe(include="all").to_csv(OUT/"descriptive_statistics.csv",encoding="utf-8-sig")
    return dict(raw_rows=len(raw),analysis_rows=len(df),excluded_rows=len(raw)-len(df),raw_duplicate_rows=int(raw.duplicated().sum()),analysis_duplicate_rows=int(df.duplicated().sum()),duplicate_customer_ids=int(raw[identifier].duplicated().sum()) if identifier else None,total_missing_raw=int(raw.isna().sum().sum()),total_missing_analysis=int(df.isna().sum().sum()),missing=missing.to_dict("records"),outliers=outliers.to_dict("records"),validity=validity,age_zero_counts={c:int((df[c]==0).sum()) for c in ["AgeHH1","AgeHH2"] if c in df},outlier_policy="IQR fences are audit flags only; valid extreme behavior is retained. No EDA imputation; missing bins are shown explicitly.",dictionary=dictionary)


def association_ranking(df):
    """Univariate numerical rank effects + categorical V, no causal wording."""
    results=[]
    for col in df:
        if col in [TARGET,"CustomerID","ServiceArea"]:continue
        s=df[col];valid=s.notna();a=s[valid&(df[TARGET]==1)];b=s[valid&(df[TARGET]==0)]
        if pd.api.types.is_numeric_dtype(s) and s.nunique()>8:
            if not len(a) or not len(b):continue
            stat,p=mannwhitneyu(a,b,alternative="two-sided",method="asymptotic")
            effect=2*stat/(len(a)*len(b))-1
            results.append(dict(variable=col,method="Rank-biserial correlation (churn minus non-churn)",effect=effect,absolute_effect=abs(effect),p_value=p,n=int(valid.sum()),retention_descriptive_only="Retention" in col))
        elif s.nunique()>1:
            table=pd.crosstab(s.fillna("Missing"),df[TARGET])
            chi,p,_,_=chi2_contingency(table)
            denom=min(table.shape)-1
            v=math.sqrt(chi/(table.values.sum()*denom)) if denom>0 else 0
            results.append(dict(variable=col,method="Cramer V (uncorrected; descriptive)",effect=v,absolute_effect=v,p_value=p,n=len(df),retention_descriptive_only="Retention" in col))
    t=pd.DataFrame(results)
    order=np.argsort(t.p_value.values);p=t.p_value.values[order];q=np.minimum.accumulate((p*len(t)/np.arange(1,len(t)+1))[::-1])[::-1]
    adjusted=np.zeros(len(t));adjusted[order]=np.minimum(1,q);t["q_value_bh"]=adjusted
    t=t.sort_values("absolute_effect",ascending=False)
    t.to_csv(OUT/"univariate_associations.csv",index=False,encoding="utf-8-sig")
    numerical=t[(t.method.str.startswith("Rank"))&(~t.retention_descriptive_only)].head(12).sort_values("absolute_effect")
    fig,ax=plt.subplots(figsize=(9.3,5.0))
    ax.barh(numerical.variable,numerical.absolute_effect,color=[ORANGE if i==numerical.index[-1] else GREY for i in numerical.index])
    ax.set_xlabel("|Rank-biserial correlation|; độ lớn liên hệ đơn biến")
    ax.spines['left'].set_visible(False)
    for i,(_,r) in enumerate(numerical.iterrows()):ax.text(r.absolute_effect+.003,i,f"{r.absolute_effect:.3f}",va="center",fontsize=9)
    top=numerical.iloc[-1]
    insight=f"Trong các biến số liên tục, {top.variable} có độ lớn liên hệ thứ hạng cao nhất (|r|={top.absolute_effect:.3f}). Giá trị này là liên hệ đơn biến, không thay thế feature importance của mô hình và không chứng minh nguyên nhân."
    finish(fig,ax,"association_ranking",f"{top.variable} dẫn đầu liên hệ đơn biến trong nhóm biến liên tục",insight,"Ưu tiên điều tra các tín hiệu có cỡ hiệu ứng đáng kể thay vì chỉ dựa vào p-value vốn nhạy với cỡ mẫu.","Tín hiệu nào còn đóng góp sau khi kết hợp các biến khác trên test?","6","Biến liên tục nào phân biệt churn rõ nhất?","Đối chiếu với importance trên holdout và dữ liệu vận hành.",True)
    return t.to_dict("records")


def supplementary_tables(df):
    """Business questions that need comparison tables, without redundant charts."""
    call_cols=[c for c in ["ReceivedCalls","OutboundCalls","InboundCalls","PeakCallsInOut","OffPeakCallsInOut","ThreewayCalls","DroppedBlockedCalls"] if c in df]
    mix=[]
    for col in call_cols:
        for state,g in df.groupby(TARGET):
            mix.append(dict(variable=col,churn=int(state),n=int(g[col].notna().sum()),mean=g[col].mean(),median=g[col].median(),q25=g[col].quantile(.25),q75=g[col].quantile(.75)))
    pd.DataFrame(mix).to_csv(OUT/"call_mix_profiles.csv",index=False,encoding="utf-8-sig")
    acceptance=[];outcome=[]
    if "RetentionCalls" in df and "RetentionOffersAccepted" in df:
        contacted=df[df.RetentionCalls>0].copy()
        accepted=(contacted.RetentionOffersAccepted>0).astype(int)
        for col in ["MonthsInService","MonthlyRevenue","CreditRating"]:
            if col not in contacted:continue
            # Derive bins from the full cohort and apply the same groups to contacted customers.
            bins,_=make_groups(df[col])
            t=rate_table(bins.loc[contacted.index],accepted).rename(columns={"churn_count":"accepted_customer_count","churn_rate":"accepted_customer_rate"})
            for row in t.to_dict("records"):acceptance.append(dict(variable=col,**row))
        outcome=rate_table(pd.Series(pd.Categorical(np.where(accepted>0,"Có ≥1 offer được chấp nhận","Không ghi nhận accepted offer")),index=contacted.index),contacted[TARGET]).to_dict("records")
    pd.DataFrame(acceptance).to_csv(OUT/"retention_acceptance_profiles.csv",index=False,encoding="utf-8-sig")
    pd.DataFrame(outcome).to_csv(OUT/"retention_contacted_outcomes.csv",index=False,encoding="utf-8-sig")
    cross_tables={}
    for x,y,slug in [("OverageMinutes","MonthlyMinutes","overage_usage"),("OverageMinutes","MonthlyRevenue","overage_revenue")]:
        if x not in df or y not in df:continue
        gx,_=make_groups(df[x]);gy,_=make_groups(df[y])
        joined=pd.Series(gx.astype(str)+" | "+gy.astype(str),index=df.index)
        tab=rate_table(joined,df[TARGET]);tab.to_csv(OUT/f"cross_{slug}.csv",index=False,encoding="utf-8-sig")
        cross_tables[slug]=dict(x=x,y=y,table=tab.to_dict("records"))
    return dict(call_mix_profiles=mix,retention_acceptance_profiles=acceptance,retention_contacted_outcomes=outcome,retention_denominator_note="Among customers with RetentionCalls>0, accepted_customer_rate = customers with RetentionOffersAccepted>0 / contacted customers. This is not accepted offers divided by offers issued; offer exposure and timing are unknown. Selection bias prevents causal retention-effect claims.",overage_cross_tables=cross_tables)


def make_interactive(df):
    import plotly.express as px
    records=[]
    use=df.copy()
    use["Trạng thái"]=use[TARGET].map({0:"Duy trì",1:"Churn"})
    # Deterministic stratified sample keeps HTML practical; counts and tables remain full-cohort.
    if len(use)>8000:
        use=use.groupby(TARGET,group_keys=False).sample(frac=8000/len(use),random_state=RANDOM_STATE)
    hover=[c for c in ["CustomerID","MonthsInService","MonthlyRevenue","MonthlyMinutes","CurrentEquipmentDays"] if c in use]
    specs=[("Usage_Behavior_Explorer","MonthlyMinutes","MonthlyRevenue","Khám phá mức sử dụng và doanh thu","Identify / compare / zoom / select"),("Early_Warning_Explorer","PercChangeMinutes","PercChangeRevenues","Khám phá hai chỉ số thay đổi hành vi","Explore / filter / identify")]
    for chart_id,x,y,title,task in specs:
        if x not in use or y not in use:continue
        fig=px.scatter(use,x=x,y=y,color="Trạng thái",color_discrete_map={"Churn":ORANGE,"Duy trì":GREY},hover_data=hover,opacity=.42,title=title,labels={x:LABELS.get(x,x),y:LABELS.get(y,y)})
        fig.update_traces(marker_size=5)
        fig.update_layout(template="plotly_white",font=dict(family="Arial",color=DARK),dragmode="zoom",legend_title_text="Bấm chú giải để lọc",title_subtitle_text=f"Interaction task: {task}. Mẫu phân tầng tái lập n={len(use):,}/{len(df):,}; biểu đồ cho phép zoom, pan, hover và chọn vùng.")
        path=INTERACTIVE/f"{chart_id}.html";fig.write_html(path,include_plotlyjs=True,full_html=True)
        records.append(dict(id="I01" if x=="MonthlyMinutes" else "I02",slug=chart_id,path=str(path),title=title,interaction_task=task,n_display=len(use),n_population=len(df),sampling="Deterministic stratified by Churn, random_state=42",interpretation="Quan hệ quan sát; các chỉ số PercChange không được gắn đơn vị phần trăm."))
    return records


def add_risk_interactive():
    import plotly.express as px
    score_path=BASE/"Cell2Cell_Churn_Risk_Scores.csv"
    if not score_path.exists():
        score_path=BASE/"output"/"Cell2Cell_Churn_Risk_Scores.csv"
    if not score_path.exists():return []
    scores=pd.read_csv(score_path)
    prob=find_col(scores,"churn_probability")
    value=find_col(scores,"customer_value_proxy","MonthlyRevenue")
    risk=find_col(scores,"risk_segment")
    records=[]
    if not prob:return []
    use=scores.sample(min(8000,len(scores)),random_state=RANDOM_STATE)
    hover=[c for c in ["customer_id","MonthlyRevenue","MonthsInService","MonthlyMinutes","risk_segment","priority_level","score_origin","key_risk_signals"] if c in use]
    risk_colors={"Low Risk":"#9EA7AE","Medium Risk":"#F0C2A8","High Risk":ORANGE,"Very High Risk":"#8B3F21"}
    risk_order={risk:["Low Risk","Medium Risk","High Risk","Very High Risk"]} if risk else {}
    if value:
        fig=px.scatter(use,x=value,y=prob,color=risk,hover_data=hover,opacity=.5,color_discrete_map=risk_colors,category_orders=risk_order,title="Khám phá xác suất churn và giá trị khách hàng")
        fig.update_layout(template="plotly_white",dragmode="zoom",legend_title_text="Bấm để lọc risk",xaxis_title="Đại diện giá trị: doanh thu hàng tháng",yaxis_title="Xác suất churn",yaxis_tickformat=".0%",title_subtitle_text=f"Interaction task: filter / identify / select. Hiển thị mẫu tái lập n={len(use):,}; điểm số lịch sử không phải danh sách churn tương lai.")
        path=INTERACTIVE/"Churn_Risk_Explorer.html";fig.write_html(path,include_plotlyjs=True)
        records.append(dict(id="I03",slug="Churn_Risk_Explorer",path=str(path),title="Churn Risk Explorer",interaction_task="Filter / identify / select / zoom",n_display=len(use),n_population=len(scores)))
    fig=px.histogram(scores,x=prob,color=risk,nbins=40,barmode="stack",color_discrete_map=risk_colors,category_orders=risk_order,title="Phân phối điểm rủi ro lịch sử")
    fig.update_layout(template="plotly_white",xaxis_tickformat=".0%",xaxis_title="Xác suất churn",yaxis_title="Số khách hàng",legend_title_text="Bấm để lọc risk",title_subtitle_text="Interaction task: compare / filter / inspect bins. Điểm số lấy từ dự đoán out-of-fold/holdout theo pipeline.")
    path=INTERACTIVE/"Risk_Distribution.html";fig.write_html(path,include_plotlyjs=True)
    records.append(dict(id="I04",slug="Risk_Distribution",path=str(path),title="Risk Distribution",interaction_task="Compare / filter / inspect bins",n_display=len(scores),n_population=len(scores)))
    return records


def run():
    for path in [OUT,CHARTS,INTERACTIVE]:path.mkdir(parents=True,exist_ok=True)
    META.clear();setup_style()
    df=pd.read_csv(DATA/"cell2cell_analysis.csv")
    raw=pd.read_csv(DATA/"cell2cell_raw.csv")
    target=find_col(df,"Churn","target")
    if target!=TARGET:df.rename(columns={target:TARGET},inplace=True)
    if not pd.api.types.is_numeric_dtype(df[TARGET]):df[TARGET]=df[TARGET].astype(str).str.lower().map({"yes":1,"no":0,"1":1,"0":0})
    if df[TARGET].isna().any() or not set(df[TARGET].unique())<={0,1}:raise ValueError("Target must be binary without missing.")
    quality=quality_audit(raw,df)
    numeric=[c for c in df.select_dtypes(include=np.number) if c not in [TARGET,"CustomerID","ServiceArea"]]
    categorical=[c for c in df if c not in numeric and c not in [TARGET,"CustomerID"]]
    summary=dict(n_customers=len(df),n_columns=len(df.columns),n_features=len(numeric)+len(categorical),n_identifier_columns=int("CustomerID" in df),n_numeric=len(numeric),n_categorical=len(categorical),n_churn=int(df[TARGET].sum()),n_non_churn=int((df[TARGET]==0).sum()),churn_rate=df[TARGET].mean(),target=TARGET,cohort="empulse loader cohort; customers with missing MonthlyRevenue excluded by source loader",random_state=RANDOM_STATE)
    if "MonthlyRevenue" in df:
        total=df.MonthlyRevenue.sum();churn_total=df.loc[df[TARGET]==1,"MonthlyRevenue"].sum()
        summary.update(monthly_revenue_total=total,churn_monthly_revenue_proxy=churn_total,churn_monthly_revenue_share=churn_total/total,median_monthly_revenue=df.MonthlyRevenue.median(),mean_monthly_revenue=df.MonthlyRevenue.mean())
    summary["core_comparisons"]={col:{str(y):dict(n=int(g[col].notna().sum()),mean=g[col].mean(),median=g[col].median(),q25=g[col].quantile(.25),q75=g[col].quantile(.75)) for y,g in df.groupby(TARGET)} for col in ["MonthlyRevenue","MonthlyMinutes","MonthsInService","TotalRecurringCharge","CurrentEquipmentDays","CustomerCareCalls","DroppedCalls","PercChangeMinutes","PercChangeRevenues"] if col in df}
    n1,n0=summary["n_churn"],summary["n_non_churn"]
    fig,ax=plt.subplots(figsize=(9.1,3.7))
    ax.barh([0],[n0],color=GREY,height=.5);ax.barh([0],[n1],left=[n0],color=ORANGE,height=.5)
    ax.text(n0/2,0,f"Duy trì\n{n0:,} ({pct(n0/len(df))})",ha="center",va="center",weight="bold")
    ax.text(n0+n1/2,0,f"Churn\n{n1:,} ({pct(n1/len(df))})",ha="center",va="center",color="white",weight="bold")
    ax.set_xlim(0,len(df));ax.set_yticks([]);ax.set_xlabel("Số khách hàng trong cohort phân tích");ax.spines['left'].set_visible(False)
    finish(fig,ax,"churn_rate",f"{pct(summary['churn_rate'])} khách hàng trong cohort đã rời bỏ dịch vụ",f"Cohort gồm {len(df):,} khách hàng: {n1:,} churn và {n0:,} duy trì. Tỷ lệ này là tỷ trọng nhãn trong nguồn, chưa phải churn rate theo tháng vì không có mốc quan sát đầy đủ.","Quy mô churn đáng kể yêu cầu xếp hạng mục tiêu; cần phân biệt khả năng churn với khả năng được giữ chân nhờ can thiệp.","Churn tập trung ở giai đoạn vòng đời và nhóm hành vi nào?","4","Quy mô churn hiện tại trong cohort là bao nhiêu?","Đặt baseline cho phân tích và đo lift của mô hình.",True)
    mt=pd.DataFrame(quality['missing']);mt=mt[mt.raw_missing>0].sort_values("raw_missing_rate").tail(12)
    fig,ax=plt.subplots(figsize=(9.2,4.8))
    ax.barh(mt.variable,mt.raw_missing_rate,color=GREY)
    ax.xaxis.set_major_formatter(PercentFormatter(1));ax.set_xlabel("Tỷ lệ thiếu trong raw cohort")
    for i,(_,row) in enumerate(mt.iterrows()):ax.text(row.raw_missing_rate+.001,i,f"{pct(row.raw_missing_rate)} ({int(row.raw_missing):,})",va="center",fontsize=8)
    insight=f"Raw có {len(raw):,} dòng, cohort phân tích {len(df):,} dòng, chênh {len(raw)-len(df):,} dòng do quy tắc nguồn. Raw có {quality['total_missing_raw']:,} ô thiếu; cohort còn {quality['total_missing_analysis']:,} ô thiếu."
    finish(fig,ax,"missing",f"Kiểm tra dữ liệu thiếu trước khi diễn giải {len(df):,} khách hàng",insight,"Không đồng nhất thiếu dữ liệu với hành vi bằng 0. Trong EDA, thiếu được giữ thành nhóm; imputation của mô hình chỉ fit trên train.","Quy tắc loại dòng thiếu MonthlyRevenue ảnh hưởng đại diện cohort ra sao?","3","Những biến nào thiếu dữ liệu và cohort thay đổi thế nào?","Đối soát nguồn và theo dõi missing rate khi scoring định kỳ.",True)
    for col,chartid,report in [("MonthsInService","MonthsInService_distribution",False),("MonthlyRevenue","MonthlyRevenue_distribution",False),("MonthlyMinutes","MonthlyMinutes_distribution",False)]:
        if col in df:distribution_chart(df,col,chartid,report)
    analyses={}
    specs=[("MonthsInService",True),("MonthlyRevenue",True),("TotalRecurringCharge",False),("MonthlyMinutes",True),("PercChangeMinutes",True),("PercChangeRevenues",True),("OverageMinutes",True),("RoamingCalls",False),("DroppedCalls",True),("BlockedCalls",False),("UnansweredCalls",False),("CustomerCareCalls",True),("CurrentEquipmentDays",True),("Handsets",False),("ActiveSubs",False),("CreditRating",True),("AgeHH1",False),("IncomeGroup",False),("RetentionCalls",False),("RetentionOffersAccepted",False)]
    for expected,report in specs:
        actual=find_col(df,expected)
        if actual:rate_chart(df,actual,analyses,report=report)
    interactions={}
    for x,y,chartid,report in [("MonthsInService","MonthlyMinutes","interaction_tenure_usage",True),("DroppedCalls","CustomerCareCalls","interaction_quality_care",True),("PercChangeMinutes","MonthlyRevenue","interaction_change_value",True),("CurrentEquipmentDays","MonthsInService","interaction_equipment_tenure",False)]:
        if x in df and y in df:interactions[chartid]=interaction_chart(df,x,y,chartid,report)
    association=association_ranking(df)
    supplementary=supplementary_tables(df)
    segment_rows=[]
    for col,an in analyses.items():
        for row in an["table"]:
            segment_rows.append(dict(variable=col,**row,relative_risk=row['churn_rate']/summary['churn_rate']))
    pd.DataFrame(segment_rows).to_csv(OUT/"segment_profiles.csv",index=False,encoding="utf-8-sig")
    interactive=make_interactive(df)+add_risk_interactive()
    write_json(OUT/"interactive_charts.json",interactive)
    result=dict(summary=summary,quality=quality,variables={row['variable']:row for row in quality['dictionary']},analyses=analyses,interactions=interactions,association_ranking=association,segment_profiles=segment_rows,supplementary=supplementary,static_chart_count=len(META),interactive=interactive,interpretation_rules=["Association is not causation.","PercChange fields retain source units: no percentage interpretation.","Revenue is a proxy, not profit or realizable protected revenue.","Raw and loader cohort counts must remain distinct.","Retention variables are descriptive and excluded from early warning.","Wilson 95% intervals accompany all group-rate tables; cells n<100 flagged.","Negative CurrentEquipmentDays values are flagged for owner verification, retained because effective-date offsets cannot be ruled out."])
    write_json(OUT/"eda.json",result);write_json(OUT/"charts.json",META)
    print(json.dumps(native(dict(summary=summary,static_chart_count=len(META),report_chart_count=sum(x['report'] for x in META),interactive_count=len(interactive))),ensure_ascii=False,indent=2))
    return result


if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--risk-only",action="store_true");args=parser.parse_args()
    if args.risk_only:
        existing=json.loads((OUT/"interactive_charts.json").read_text(encoding="utf-8")) if (OUT/"interactive_charts.json").exists() else []
        existing=[r for r in existing if r['id'] not in ["I03","I04"]]+add_risk_interactive()
        write_json(OUT/"interactive_charts.json",existing)
        if (OUT/"eda.json").exists():
            cached=json.loads((OUT/"eda.json").read_text(encoding="utf-8"))
            cached["interactive"]=existing
            write_json(OUT/"eda.json",cached)
        print(f"Interactive explorers: {len(existing)}")
    else:run()
