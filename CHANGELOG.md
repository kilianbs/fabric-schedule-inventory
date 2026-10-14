# Changelog

## 1.0.0

First stable release.

- Server-side `syncInventory` function scans every Fabric workspace the app identity can access and stores schedulable items that have at least one schedule, with their schedules and last job runs.
- Inventory page: search, capacity / workspace / item-type filters, sorting, paging, portal links and schedule detail.
- Gantt page: 24-hour timeline with average run duration, load strip and capacity info.
- Sync progress with live status and error reporting.
- About page describing what the app stores and the latest sync.
