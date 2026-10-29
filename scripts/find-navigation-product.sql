.headers on
.mode tabs
select path, revision, operation, substr(value, 1, 1000) as value
from state_overrides
where value like '%91%'
order by revision desc
limit 20;
