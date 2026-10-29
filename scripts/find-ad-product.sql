\pset format aligned
select p.id, p.name, p.status, p.target_url, p.updated_at,
       count(distinct c.id) as creatives,
       count(distinct d.id) as deliveries
from products p
left join creatives c on c.product_id = p.id
left join deliveries d on d.product_id = p.id
where p.name ilike '%91%' or coalesce(p.target_url, '') ilike '%91%'
group by p.id, p.name, p.status, p.target_url, p.updated_at
order by p.updated_at desc;

select c.id, c.name, c.type, c.status, c.target_url, c.updated_at
from creatives c join products p on p.id = c.product_id
where p.name ilike '%91%'
order by c.updated_at desc;

select d.id, d.name, d.status, d.start_at, d.end_at, d.placement_id, d.updated_at
from deliveries d join products p on p.id = d.product_id
where p.name ilike '%91%'
order by d.updated_at desc;

select a.id, a.name, a.mime, a.size, pa.is_primary, pa.created_at
from product_assets pa
join assets a on a.id = pa.asset_id
join products p on p.id = pa.product_id
where p.name = '91免费'
order by pa.is_primary desc, pa.created_at desc;
