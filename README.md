# Northstar Inventory

Northstar Inventory is an internal operations system for managing a shared product catalog, location-based stock, supplier purchasing, and sales fulfillment across warehouses and branches.

The app is built with Next.js 16 App Router, Prisma, PostgreSQL, NextAuth credentials auth, and Tailwind CSS. It is designed for back-office teams that need practical inventory controls rather than a marketing site.

## Core Capabilities

- Product catalog management with categories, brands, supplier links, and archive status.
- Warehouse and branch management through a unified `StockLocation` model.
- Location-level stock tracking, stock setup, manual adjustments, transfers, and supplier receipts.
- Purchase order creation, approval, and receiving workflows.
- Sales order capture with branch-aware fulfillment and payment allocation rules.
- Role-based access for admins, system managers, and sales staff.

## Project Structure

- `app/`: App Router routes, pages, and server entry points.
- `components/`: UI components and workflow-specific forms.
- `lib/actions/`: server actions for inventory, purchasing, sales, auth, users, and setup flows.
- `lib/dal/`: read-side data access used by dashboards and detail pages.
- `lib/validators/`: Zod schemas plus form/query parsing helpers.
- `prisma/`: schema and migrations.
- `scripts/`: operational one-off scripts.
- `tests/`: Vitest coverage for core business-rule modules.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- PostgreSQL 15 or newer

## Environment Variables

Copy `.env.example` to `.env` and fill in real values.

```bash
copy .env.example .env
```

Required variables:

- `DATABASE_URL`: PostgreSQL connection string used by Prisma and runtime data access.
- `AUTH_SECRET`: secret used to sign auth/session tokens.

Compatibility note:

- `proxy.ts` also accepts `NEXTAUTH_SECRET` as a fallback, but `AUTH_SECRET` should be the primary value going forward.

## Local Setup

1. Install dependencies.

```bash
npm install
```

2. Apply database migrations.

```bash
npx prisma migrate dev
```

3. Start the development server.

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Useful Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run test:watch
npx prisma studio
npx prisma migrate dev
npx prisma migrate deploy
npm run backfill:costing
```

## Authentication and Roles

The app uses NextAuth credentials authentication with users stored in Prisma.

Available roles:

- `ADMIN`: full system access.
- `SYSTEM_MANAGER`: operational control with limited system ownership actions.
- `SALES_STAFF`: restricted access focused on dashboard, catalog visibility, inventory visibility, and sales execution.

Sales staff have a two-step entry flow:

1. Sign in with email and password.
2. Select an active branch before entering the dashboard.

## Inventory and Purchasing Workflows

### Product onboarding

1. Create categories and brands if needed.
2. Create a product in the shared catalog.
3. Optionally bulk import products from spreadsheet data.
4. Load opening balances with the stock setup flow.

### Supplier purchasing

1. Create a purchase order for a supplier.
2. Approve the order.
3. Receive against that PO from the inventory receiving screen.
4. Inventory movements and stock updates are posted during receipt.

### Direct supplier receipts

Use the direct supplier receipt path only when stock arrives without a purchase order. This updates on-hand inventory immediately, but it bypasses the PO lifecycle.

### Stock corrections and movement

- Use stock setup for opening balances or migration-style loads.
- Use manual adjustment for controlled quantity corrections.
- Use transfers to move stock between warehouse and branch locations.

## Costing

Location cost snapshots and cost history are maintained with a moving-average model.

- `lib/costing.ts` contains the shared moving-average logic.
- `npm run backfill:costing` rebuilds location cost snapshots and related sales-line cost values after data repair or schema changes.

Run the backfill carefully in a non-production environment first whenever historical costing behavior has changed.

## Operational Scripts

These scripts are intended for setup and controlled admin intervention:

- `npx tsx scripts/create-demo-user.ts`: creates a demo `SALES_STAFF` account.
- `npx tsx scripts/make-admin.ts user@email.com`: promotes an existing user to `ADMIN`.

Review the script contents before using them in shared or production environments.

## Testing

Vitest is configured for business-rule coverage in `tests/`.

Current coverage focuses on high-risk inventory and transaction logic:

- moving-average cost calculations
- sales order payment validation
- purchase-order receive parsing and filter normalization
- product import validation and inventory transfer validation

Run the suite with:

```bash
npm run test
```

## Deployment Notes

- Run `npm run build` before deployment.
- Run `npx prisma migrate deploy` as part of release rollout.
- Ensure `DATABASE_URL` and `AUTH_SECRET` are present in the target environment.
- Verify at least one active admin account exists before handing the system to operators.

## Current Caveats

- `Audit Logs` and `Settings` appear in navigation for elevated roles, but those sections are not yet implemented as dedicated dashboard modules.
- This repository may contain one-off planning docs and prompt artifacts that are not part of the runtime application.

## Ownership Notes

This project handles inventory, receiving, and sales state changes. Treat production changes carefully:

- prefer validating in staging with a copy of representative data
- keep Prisma migrations reviewed and reversible
- verify stock-affecting flows after changes to purchasing, transfers, or sales logic
