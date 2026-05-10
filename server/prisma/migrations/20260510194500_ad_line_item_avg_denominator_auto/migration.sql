-- 평균 분모: DB 플래그를 「광고비 합산 제외」와 일치시킴 (종료 화면·스냅샷 일관성)
UPDATE ad_channel_line_items SET use_as_avg_denominator = NOT counts_for_spend;
