# tenant-quota

A usage-accounting service for a small number of tenants.

`record` accumulates usage, `consumed` reports it, `remaining` subtracts it from
the tenant's limit, and `report` builds a per-tenant summary for the dashboard.

The service began life single-tenant and some of it still assumes that.
