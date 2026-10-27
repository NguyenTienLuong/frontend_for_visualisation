"""Historical risk prioritisation and model visual evidence, calculated from outputs."""
from pathlib import Path
import json
import math
import os
import textwrap
os.environ.setdefault('MPLCONFIGDIR', str(Path(__file__).resolve().parents[1] / 'output' / '.matplotlib'))
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.ticker import PercentFormatter

BASE = Path(__file__).resolve().parents[1]
OUT = BASE / 'output' / 'analysis'
FIG = BASE / 'output' / 'figures'
ORANGE, GREY, DARK = '#D66A35', '#A6ADB4', '#273541'

def dump(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2, default=lambda x: x.item() if hasattr(x, 'item') else str(x)), encoding='utf-8')

def run():
    FIG.mkdir(parents=True, exist_ok=True)
    summary = json.loads((OUT / 'model_summary.json').read_text(encoding='utf-8'))
    scores = pd.read_csv(OUT / 'predictions_historical_oof.csv')
    data = pd.read_csv(BASE / 'data' / 'cell2cell_analysis.csv').rename(columns={'CustomerID':'customer_id'})
    for col in data:
        if col not in scores and col != 'Churn':
            scores[col] = data.set_index('customer_id').loc[scores.customer_id, col].to_numpy()
    p = scores.churn_probability
    cuts = summary['risk_boundaries_validation_quantiles']
    value_cut = summary['high_value_threshold_train_median']
    scores['risk_segment'] = np.select([p >= cuts['very_high'], p >= cuts['high'], p >= cuts['medium']], ['Very High Risk','High Risk','Medium Risk'], default='Low Risk')
    scores['customer_value_proxy'] = scores.MonthlyRevenue.clip(lower=0)
    scores['value_segment'] = np.where(scores.MonthlyRevenue >= value_cut, 'High Value', 'Lower Value')
    high_risk = p >= cuts['high']
    high_value = scores.MonthlyRevenue >= value_cut
    medium_risk = p >= cuts['medium']
    scores['priority_level'] = np.select([high_risk & high_value, medium_risk & high_value, medium_risk & ~high_value], ['P1','P2','P3'], default='P4')
    scores['priority_score'] = p * scores.customer_value_proxy
    scores['outreach_eligible_historical_status'] = scores.observed_churn.eq(0)
    scores['requires_current_status_confirmation'] = True
    thresholds = summary['signal_thresholds_train']
    conditions = {
        'usage_decline': (scores.PercChangeMinutes <= thresholds['PercChangeMinutes']['q25']) & (scores.PercChangeMinutes < 0),
        'revenue_decline': (scores.PercChangeRevenues <= thresholds['PercChangeRevenues']['q25']) & (scores.PercChangeRevenues < 0),
        'quality': scores.DroppedBlockedCalls > thresholds['DroppedBlockedCalls']['q75'],
        'care': scores.CustomerCareCalls > thresholds['CustomerCareCalls']['q75'],
        'equipment': scores.CurrentEquipmentDays > thresholds['CurrentEquipmentDays']['q75'],
        'tenure_band': (scores.MonthsInService > thresholds['MonthsInService']['q25']) & (scores.MonthsInService <= thresholds['MonthsInService']['median']),
    }
    # A descriptive flag is a risk signal only if its train-cohort churn rate is
    # above the train baseline. Inverse or unsupported associations stay out.
    training = scores.benchmark_split.eq('train')
    baseline = scores.loc[training, 'observed_churn'].mean()
    signal_evidence = {}
    for name, mask in list(conditions.items()):
        n = int((mask & training).sum())
        rate = float(scores.loc[mask & training, 'observed_churn'].mean()) if n else None
        z = 1.959963984540054
        lower = ((rate + z*z/(2*n)) - z*np.sqrt(rate*(1-rate)/n + z*z/(4*n*n))) / (1+z*z/n) if n and rate is not None else None
        supported = n >= 100 and lower is not None and lower > baseline
        signal_evidence[name] = {'train_customers':n, 'train_churn_rate':rate, 'wilson_lower_95':lower, 'train_baseline':float(baseline), 'included_as_risk_signal':supported}
        if not supported:
            conditions[name] = pd.Series(False, index=scores.index)
    labels = {'usage_decline':'Mức thay đổi sử dụng thuộc tứ phân vị thấp', 'revenue_decline':'Mức thay đổi doanh thu thuộc tứ phân vị thấp', 'quality':'Cuộc gọi rớt hoặc bị chặn cao hơn Q75', 'care':'Liên hệ chăm sóc cao hơn Q75', 'equipment':'Tuổi thiết bị cao hơn Q75', 'tenure_band':'Thời gian gắn bó giữa Q25 và trung vị huấn luyện'}
    flags = pd.DataFrame(conditions)
    scores['key_risk_signals'] = ['; '.join(labels[c] for c in flags if flags.iloc[i][c]) or 'Tổ hợp đặc trưng được mô hình nhận diện; cần xác minh qua chăm sóc' for i in range(len(scores))]
    scores['customer_persona'] = np.select([
        high_risk & high_value,
        high_risk & (conditions['quality'] | conditions['care']),
        high_risk & conditions['usage_decline'],
        high_risk & conditions['equipment'],
        high_risk,
    ], ['Giá trị cao và rủi ro cao','Rủi ro cao kèm tín hiệu trải nghiệm','Rủi ro cao kèm giảm sử dụng','Rủi ro cao kèm thiết bị sử dụng lâu','Rủi ro cao còn lại'], default='Nhóm theo dõi và duy trì quan hệ')
    actions = {
        'Giá trị cao và rủi ro cao':'Ưu tiên tư vấn cá nhân; kiểm tra chất lượng, gói cước và nhu cầu trước khi đề xuất ưu đãi',
        'Rủi ro cao kèm tín hiệu trải nghiệm':'Rà soát sự cố và lịch sử hỗ trợ; xử lý nguyên nhân rồi liên hệ xác nhận',
        'Rủi ro cao kèm giảm sử dụng':'Xác minh thay đổi nhu cầu; tư vấn gói cước và kích hoạt lại sử dụng phù hợp',
        'Rủi ro cao kèm thiết bị sử dụng lâu':'Kiểm tra khả năng đáp ứng của thiết bị; tư vấn đổi thiết bị khi xác minh nhu cầu và điều kiện kinh tế',
        'Rủi ro cao còn lại':'Chăm sóc tự động và khảo sát ngắn; chuyển chuyên viên khi phát hiện vấn đề',
        'Nhóm theo dõi và duy trì quan hệ':'Theo dõi định kỳ và chăm sóc theo nhu cầu; chưa cấp ưu đãi đại trà',
    }
    scores['recommended_action'] = scores.customer_persona.map(actions)
    scores.loc[scores.observed_churn.eq(1), 'recommended_action'] = 'Đã ghi nhận churn trong dữ liệu lịch sử; chỉ phân tích nguyên nhân hoặc thiết kế win-back riêng'
    primary = ['customer_id','churn_probability','risk_segment','customer_value_proxy','priority_level','key_risk_signals','recommended_action','customer_persona','value_segment','priority_score','observed_churn','outreach_eligible_historical_status','requires_current_status_confirmation','score_basis','score_fold','benchmark_split']
    scores = scores[primary + [c for c in scores if c not in primary]].sort_values(['priority_level','priority_score','churn_probability','customer_id'], ascending=[True,False,False,True])
    scores.to_csv(BASE / 'Cell2Cell_Churn_Risk_Scores.csv', index=False, encoding='utf-8-sig')
    candidates = scores.loc[scores.observed_churn.eq(0)]
    candidates.to_csv(BASE / 'Cell2Cell_Retention_Candidates_Historical.csv', index=False, encoding='utf-8-sig')
    candidate_priorities = candidates.groupby('priority_level').agg(customers=('customer_id','size'),mean_probability=('churn_probability','mean'),value_proxy_sum=('customer_value_proxy','sum')).reset_index()
    candidate_priorities.to_csv(OUT / 'candidate_priority_summary.csv', index=False)
    personas = scores.groupby('customer_persona', observed=True).agg(customers=('customer_id','size'),actual_churn=('observed_churn','sum'),churn_rate=('observed_churn','mean'),mean_probability=('churn_probability','mean'),monthly_revenue_mean=('MonthlyRevenue','mean'),monthly_minutes_mean=('MonthlyMinutes','mean'),value_proxy_sum=('customer_value_proxy','sum')).reset_index()
    personas['recommended_action'] = personas.customer_persona.map(actions)
    personas.to_csv(OUT / 'personas.csv', index=False, encoding='utf-8-sig')
    priority = scores.groupby('priority_level').agg(customers=('customer_id','size'),actual_churn=('observed_churn','sum'),churn_rate=('observed_churn','mean'),mean_probability=('churn_probability','mean'),value_proxy_sum=('customer_value_proxy','sum')).reset_index()
    priority.to_csv(OUT / 'priority_summary.csv', index=False)
    risk = scores.groupby('risk_segment').agg(customers=('customer_id','size'),actual_churn=('observed_churn','sum'),churn_rate=('observed_churn','mean'),mean_probability=('churn_probability','mean')).reset_index()
    risk.to_csv(OUT / 'risk_segments.csv', index=False)
    dump(OUT / 'risk_summary.json', {'risk_cutoffs':cuts,'high_value_threshold':value_cut,'total_scored':len(scores),'historical_nonchurn_candidates':len(candidates),'candidate_priorities':candidate_priorities.to_dict('records'),'personas':personas.to_dict('records'),'priorities':priority.to_dict('records'),'risk_segments':risk.to_dict('records'),'signal_evidence_train':signal_evidence,'score_caveat':summary['historical_score_caveat'],'policy_note':'Risk bands use validation quantiles. P1 high value and high risk; P2 high value and medium risk; P3 lower value and medium/high risk; P4 otherwise. Revenue times risk is an exposure ranking proxy, not CLV, avoidable loss or incremental retention benefit. Descriptive flags require n>=100 and Wilson 95% lower bound above train baseline; these heuristic flags are not model-local explanations or confirmatory causal tests.'})

    plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'axes.labelcolor':DARK,'text.color':DARK,'axes.titleweight':'bold','figure.facecolor':'white','savefig.facecolor':'white'})
    charts = []
    def save(fig, id, title, insight, meaning, question, report=True):
        fig.suptitle(textwrap.fill(title, 88), fontsize=13, fontweight='bold', x=.04, ha='left', y=.99)
        fig.tight_layout(rect=[0,.02,1,.89])
        path = FIG / f'{id}.png'
        fig.savefig(path, dpi=170, bbox_inches='tight')
        plt.close(fig)
        charts.append({'id':id,'path':str(path.relative_to(BASE)),'title':title,'insight':insight,'business_meaning':meaning,'next_question':question,'section':'Mô hình và ưu tiên khách hàng','question':question,'decision':meaning,'report':report})

    comparison = pd.read_csv(OUT / 'model_comparison_validation.csv')
    selected = summary['selected_model']
    test = summary['test']
    fig, ax = plt.subplots(figsize=(8.2,4.1))
    ordered = comparison.sort_values('pr_auc_average_precision')
    ax.barh(ordered.model, ordered.pr_auc_average_precision, color=[ORANGE if x == selected else GREY for x in ordered.model])
    for i, v in enumerate(ordered.pr_auc_average_precision): ax.text(v+.006,i,f'{v:.3f}',va='center')
    ax.axvline(summary['validation_selected']['churn_rate'],color=GREY,ls='--',label='Tỷ lệ churn validation')
    ax.set(xlabel='Average precision trên validation',xlim=(0,max(.6,ordered.pr_auc_average_precision.max()*1.17)))
    ax.legend(frameon=False,loc='lower right')
    save(fig,'M01',f'{selected} dẫn đầu xếp hạng trên validation',f'Average precision validation của mô hình được chọn là {summary["validation_selected"]["pr_auc_average_precision"]:.3f}.','Chọn theo chất lượng xếp hạng và xem xét khả năng vận hành.','Mức cải thiện so với Logistic Regression có đủ để bù độ phức tạp?')
    for id, kind, xlabel, ylabel in [('M02','roc','False positive rate','Recall'),('M03','pr','Recall','Precision')]:
        fig, axes = plt.subplots(1,2,figsize=(9,4.1))
        for idx, row in comparison.iterrows():
            slug=row.model.lower().replace(' ','_')
            curve=pd.read_csv(OUT/f'validation_{slug}_{kind}.csv')
            xcol,ycol=('false_positive_rate','true_positive_rate') if kind=='roc' else ('recall','precision')
            axes[0].plot(curve[xcol],curve[ycol],label=row.model,color=ORANGE if row.model==selected else ['#9BA2A8','#566773','#C0C6CB'][idx%3],lw=2 if row.model==selected else 1)
        curve=pd.read_csv(OUT/f'test_selected_{kind}.csv')
        axes[1].plot(curve[xcol],curve[ycol],color=ORANGE,lw=2,label='Mô hình đã đóng băng')
        for ax in axes:
            if kind=='roc': ax.plot([0,1],[0,1],ls='--',color=GREY,lw=1)
            else: ax.axhline(test['churn_rate'] if ax is axes[1] else summary['validation_selected']['churn_rate'],ls='--',color=GREY,lw=1)
            ax.set(xlabel=xlabel,ylabel=ylabel,xlim=(0,1),ylim=(0,1)); ax.legend(frameon=False,fontsize=7,loc='best')
        axes[0].set_title('So sánh validation',fontsize=10); axes[1].set_title('Đánh giá test độc lập',fontsize=10)
        metric = 'roc_auc' if kind=='roc' else 'pr_auc_average_precision'
        save(fig,id,f'{"ROC AUC" if kind=="roc" else "Average precision"} trên test đạt {test[metric]:.3f}',f'Kết quả test được tính sau khi chọn mô hình và ngưỡng bằng validation; {metric}={test[metric]:.3f}.','Kết quả là bằng chứng đánh giá lịch sử; cần backtest theo thời gian khi có snapshot.','Chất lượng xếp hạng có ổn định trên kỳ dữ liệu tiếp theo?')

    th=pd.read_csv(OUT/'threshold_analysis_validation.csv')
    fig,ax=plt.subplots(figsize=(8.2,4.1))
    for c,color in [('precision',DARK),('recall',ORANGE),('targeted_fraction',GREY)]:
        values = th[c].where(th.targeted_n.gt(0)) if c=='precision' else th[c]
        ax.plot(th.threshold,values,label=c,color=color)
    ax.axvline(summary['selected_threshold_validation'],ls='--',color=ORANGE,lw=1)
    ax.set(xlabel='Ngưỡng xác suất trên validation',ylabel='Tỷ lệ');ax.yaxis.set_major_formatter(PercentFormatter(1));ax.legend(frameon=False)
    save(fig,'M04',f'Ngưỡng {summary["selected_threshold_validation"]:.3f} tương ứng kịch bản năng lực top 20%',f'Ngưỡng được lấy từ phân vị validation cho kịch bản liên hệ {summary["capacity_scenario"]:.0%}; chưa có năng lực vận hành thực tế được cung cấp.','Đội retention cần xác nhận năng lực và chi phí trước khi chốt ngưỡng chiến dịch.','Năng lực thực tế và chi phí liên hệ là bao nhiêu?')

    matrix=np.array([[test['tn'],test['fp']],[test['fn'],test['tp']]])
    fig,ax=plt.subplots(figsize=(7.6,4.1));ax.imshow(matrix,cmap='Oranges')
    for i in range(2):
        for j in range(2): ax.text(j,i,f'{matrix[i,j]:,}',ha='center',va='center',fontsize=18,color='white' if matrix[i,j] > matrix.max()*.6 else DARK)
    ax.set(xticks=[0,1],yticks=[0,1],xticklabels=['Không cảnh báo','Cảnh báo'],yticklabels=['Không churn','Churn'],xlabel='Dự đoán ở ngưỡng validation',ylabel='Kết quả quan sát trên test')
    save(fig,'M05',f'Mô hình nhận diện {test["tp"]:,} churner và bỏ sót {test["fn"]:,} trên test',f'Có {test["fp"]:,} false positive và {test["fn"]:,} false negative tại ngưỡng đã đóng băng.','False positive tiêu tốn chăm sóc; false negative là cơ hội bị bỏ lỡ. Không suy ra số người có thể giữ chân.','Can thiệp chi phí thấp có phù hợp nhóm dương tính giả?')

    cal=pd.read_csv(OUT/'test_selected_calibration.csv')
    fig,ax=plt.subplots(figsize=(7.6,4.1));ax.plot(cal.mean_predicted_probability,cal.observed_churn_rate,marker='o',color=ORANGE);ax.plot([0,1],[0,1],color=GREY,ls='--');ax.set(xlim=(0,1),ylim=(0,1),xlabel='Xác suất dự đoán trung bình mỗi nhóm',ylabel='Tỷ lệ churn quan sát')
    save(fig,'M06',f'Brier score trên test bằng {test["brier_score"]:.3f}',f'Kiểm tra hiệu chỉnh dùng các nhóm phân vị xác suất trên test; calibrated={summary["calibrated"]}.','Xác suất cần được theo dõi độ hiệu chỉnh khi áp dụng cho cohort và thời điểm mới.','Sai lệch hiệu chỉnh có tăng theo thời gian?')

    imp=pd.read_csv(OUT/'permutation_importance_test.csv').head(12).sort_values('importance_mean_pr_auc_decrease')
    fig,ax=plt.subplots(figsize=(8.5,4.7));ax.barh(imp.feature,imp.importance_mean_pr_auc_decrease,xerr=imp.importance_std,color=[ORANGE if x==imp.feature.iloc[-1] else GREY for x in imp.feature]);ax.axvline(0,color=DARK,lw=.6);ax.set(xlabel='Mức giảm average precision khi hoán vị đặc trưng')
    save(fig,'M07',f'{imp.feature.iloc[-1]} có mức đóng góp xếp hạng lớn nhất khi hoán vị',f'Permutation importance lớn nhất trong lần đánh giá là {imp.feature.iloc[-1]}; độ biến thiên được thể hiện bằng thanh sai số.','Đây là phụ thuộc dự báo của mô hình, chịu ảnh hưởng của tương quan giữa các biến.','Kết quả còn ổn định nếu bỏ các biến tương quan?')

    dec=pd.read_csv(OUT/'deciles_test.csv')
    fig,ax=plt.subplots(figsize=(8.2,4.1));ax.bar(dec.decile,dec.churn_rate,color=[ORANGE if x<=2 else GREY for x in dec.decile]);ax.axhline(test['churn_rate'],color=DARK,ls='--',label='Toàn bộ test');ax.set(xlabel='Decile 1 có rủi ro dự đoán cao nhất',ylabel='Tỷ lệ churn quan sát',xticks=dec.decile);ax.yaxis.set_major_formatter(PercentFormatter(1));ax.legend(frameon=False)
    top=dec.iloc[0]
    save(fig,'M08',f'Decile rủi ro cao nhất có churn rate {top.churn_rate:.1%}',f'Decile 1 gồm {int(top.customers):,} người và {int(top.actual_churn):,} churner; churn rate={top.churn_rate:.1%}.','Kết hợp tỷ lệ churn với quy mô nhóm để đánh giá khả năng tập trung nguồn lực.','Nhóm giá trị cao chiếm bao nhiêu trong decile đầu?')

    target=pd.read_csv(OUT/'targeting_test.csv')
    t20=target.loc[np.isclose(target.capacity,.2)].iloc[0]
    fig,ax=plt.subplots(figsize=(8.2,4.1));ax.plot(np.r_[0,dec.cumulative_fraction],np.r_[0,dec.cumulative_capture],color=ORANGE,lw=2,label='Mô hình');ax.plot([0,1],[0,1],color=GREY,ls='--',label='Chọn ngẫu nhiên');ax.scatter([t20.capacity],[t20.capture_recall],color=ORANGE);ax.annotate(f'Top 20%: {t20.capture_recall:.1%} churner\nLift {t20.lift:.2f} lần',(t20.capacity,t20.capture_recall),xytext=(.38,.28),arrowprops={'arrowstyle':'->','color':ORANGE});ax.set(xlabel='Tỷ lệ khách hàng được chọn trên test',ylabel='Tỷ lệ churner được bao phủ');ax.xaxis.set_major_formatter(PercentFormatter(1));ax.yaxis.set_major_formatter(PercentFormatter(1));ax.legend(frameon=False)
    save(fig,'M09',f'Top 20% rủi ro bao phủ {t20.capture_recall:.1%} churner trên test',f'Đội retention chọn {int(t20.customers):,} người sẽ bao phủ {int(t20.actual_churn):,} churner đã quan sát trong test, lift {t20.lift:.2f} lần.','Đây là hiệu quả nhận diện; số được giữ chân và doanh thu tăng thêm phải đo bằng nhóm đối chứng.','Tỷ lệ giữ chân tăng thêm trong thử nghiệm là bao nhiêu?')

    sample=scores.sample(min(6500,len(scores)),random_state=42)
    fig,ax=plt.subplots(figsize=(8.2,4.1));ax.scatter(sample.customer_value_proxy,sample.churn_probability,c=np.where(sample.priority_level.eq('P1'),ORANGE,GREY),s=8,alpha=.35,rasterized=True);ax.axvline(value_cut,color=DARK,ls='--',lw=.9);ax.axhline(cuts['high'],color=DARK,ls='--',lw=.9);ax.set(xlabel='MonthlyRevenue không âm làm đại diện giá trị',ylabel='Xác suất OOF lịch sử');ax.set_xscale('symlog',linthresh=20);ax.set_xlim(left=0,right=float(sample.customer_value_proxy.max())*1.15);ticks=[v for v in [0,20,50,100,250,500,1000] if v <= ax.get_xlim()[1]];ax.set_xticks(ticks,labels=[str(v) for v in ticks])
    p1=priority.loc[priority.priority_level.eq('P1')].iloc[0]
    save(fig,'M10',f'{int(p1.customers):,} khách hàng thuộc nhóm giá trị cao và rủi ro cao',f'P1 chiếm {p1.customers/len(scores):.1%} cohort lịch sử; trục giá trị dùng thang symlog để giữ cả mức bằng không và giá trị lớn.','Danh sách ưu tiên kết hợp rủi ro và giá trị, cần xác nhận trạng thái hiện tại trước liên hệ.','Có bao nhiêu người còn hoạt động ở snapshot triển khai?')
    fig,ax=plt.subplots(figsize=(8.2,4.1))
    ax.hist(scores.churn_probability,bins=40,color=GREY,edgecolor='white',linewidth=.35)
    for label,cut in cuts.items():
        ax.axvline(cut,color=ORANGE,ls='--',lw=1)
        ax.text(cut,ax.get_ylim()[1]*.95,label,rotation=90,ha='right',va='top',fontsize=9,color=ORANGE)
    ax.set(xlabel='Xác suất churn OOF lịch sử',ylabel='Số khách hàng')
    save(fig,'M11','Phân vị validation định nghĩa bốn mức rủi ro lịch sử',f'Ngưỡng Medium={cuts["medium"]:.3f}, High={cuts["high"]:.3f} và Very High={cuts["very_high"]:.3f}; áp dụng cho {len(scores):,} điểm OOF.','Ngưỡng phân vị tạo thứ tự ưu tiên, cần điều chỉnh theo năng lực và dữ liệu kỳ triển khai.','Quy mô từng nhóm có thay đổi ở snapshot mới?')
    dump(OUT/'model_charts.json',charts)
    print(f'Risk scores: {len(scores):,}; historical non-churn candidates: {len(candidates):,}; charts: {len(charts)}')
    return scores, charts

if __name__ == '__main__':
    run()
