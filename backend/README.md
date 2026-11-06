# ServiceHub Backend API

A NestJS backend for the ServiceHub marketplace platform, providing authentication, bookings, reviews, and reporting functionality.

## Features

- **Multi-User Authentication**: JWT-based auth for customers, service providers, and admins
- **Bookings Management**: Create, update, and track service bookings
- **Reviews System**: Customers can review providers after completed bookings
- **Block/Report System**: Users can block or report other users
- **Email Notifications**: Automated emails for booking confirmations and status updates
- **Admin Dashboard**: Comprehensive admin controls and statistics

## Tech Stack

- **Framework**: NestJS 10
- **Database**: MySQL with TypeORM
- **Authentication**: JWT with refresh tokens
- **Validation**: class-validator & class-transformer
- **Documentation**: Swagger/OpenAPI
- **Email**: Nodemailer with Handlebars templates

## Prerequisites

- Node.js 18+
- MySQL 8.0+
- npm or yarn

## Installation

1. **Clone and install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Set the `DB_*` values to your MySQL server. Every setting is explained in
   `.env.example`. Mail, Google and the AI keys are optional for development.

3. **Create the database, tables and seed data**:
   ```bash
   npm run db:setup
   ```
   This creates the `DB_DATABASE` database if needed and runs every file in
   `database/migrations/`, then every file in `database/seeds/`, in order.
   Use `npm run db:reset` to drop and rebuild it. See the root `README.md` for
   manual (DBeaver / mysql CLI) instructions.

   On a production server use `npm run db:setup -- --production` instead,
   which skips the demo and test seeds, then `npm run admin:create` for the
   first admin. See [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).

4. **Start the server**:
   ```bash
   # Development
   npm run start:dev
   
   # Production
   npm run build
   npm run start:prod
   ```

## API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:3001/api/docs`
- OpenAPI JSON: `http://localhost:3001/api/docs-json`

## API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/customer/register` | Register a new customer |
| POST | `/customer/login` | Customer login |
| POST | `/provider/register` | Register a service provider |
| POST | `/provider/login` | Provider login |
| POST | `/admin/login` | Admin login |
| POST | `/refresh` | Refresh access token |
| POST | `/logout` | Logout (invalidate refresh token) |
| POST | `/forgot-password` | Request password reset |
| POST | `/reset-password` | Reset password with token |

### Services (`/api/services`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all services |
| GET | `/:id` | Get service details |
| GET | `/:id/providers` | Get providers for a service |
| POST | `/` | Create service (admin) |
| PATCH | `/:id` | Update service (admin) |
| DELETE | `/:id` | Delete service (admin) |

### Customers (`/api/customers`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profile` | Get current customer profile |
| PATCH | `/profile` | Update customer profile |
| GET | `/bookings` | Get customer's bookings |
| GET | `/reviews` | Get customer's reviews |

### Providers (`/api/providers`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all active providers |
| GET | `/:id` | Get provider details |
| GET | `/profile` | Get current provider profile |
| PATCH | `/profile` | Update provider profile |
| GET | `/bookings` | Get provider's bookings |
| POST | `/services` | Add a service offering |
| PATCH | `/services/:id` | Update service offering |
| DELETE | `/services/:id` | Remove service offering |

### Bookings (`/api/bookings`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create a new booking |
| GET | `/:id` | Get booking details |
| PATCH | `/:id/status` | Update booking status |
| POST | `/:id/cancel` | Cancel a booking |

### Payments (`/api/payments`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create a payment |
| GET | `/:id` | Get payment details |
| POST | `/:id/complete` | Mark payment as complete |

### Reviews (`/api/reviews`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create a review |
| GET | `/provider/:id` | Get reviews for a provider |
| PATCH | `/:id` | Update a review |
| DELETE | `/:id` | Delete a review |

### Reports (`/api/reports`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create a report/block |
| GET | `/` | Get reports (admin) |
| PATCH | `/:id` | Resolve a report (admin) |

### Chat (`/api/v1/chat`)

Customer <-> provider chat, one conversation per booking. Either side asks to
open it, an admin approves it, then both can send messages. While a chat
panel is open the frontend polls `GET /messages` every few seconds.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/approvals` | Chat approvals (all for admins, own bookings otherwise) |
| POST | `/approvals` | Ask to open chat on a booking (its customer or assigned provider) |
| PATCH | `/approvals/:id` | Approve or reject / close a chat (admin) |
| GET | `/messages?bookingId=` | A booking's messages (participants, or an admin reading a dispute) |
| POST | `/messages` | Send a message on an approved booking chat |

### Admin (`/api/v1/admins`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Get dashboard statistics |
| GET | `/customers` | List all customers |
| GET | `/providers` | List all providers |
| POST | `/providers/:id/verify` | Verify a provider |
| POST | `/users/:type/:id/suspend` | Suspend a user |
| POST | `/users/:type/:id/activate` | Activate a user |

## Project Structure

```
backend/
├── src/
│   ├── common/
│   │   └── decorators/          # Custom decorators
│   ├── modules/
│   │   ├── auth/                # Authentication module
│   │   ├── admins/              # Admin management
│   │   ├── bookings/            # Booking management
│   │   ├── customers/           # Customer management
│   │   ├── mail/                # Email service
│   │   ├── payments/            # Payment processing
│   │   ├── providers/           # Provider management
│   │   ├── reports/             # Block/report system
│   │   ├── reviews/             # Review system
│   │   └── services/            # Service categories
│   ├── app.module.ts            # Root module
│   └── main.ts                  # Application entry
├── database/
│   ├── migrations/              # SQL migration scripts
│   ├── seeds/                   # Seed data ("demo"/"test" ones are development only)
│   ├── setup.js                 # npm run db:setup / db:reset
│   ├── create-admin.js          # npm run admin:create / admin:reset-password / admin:deactivate
│   └── disable-demo-accounts.js # npm run db:disable-demo-accounts
├── .env.example                 # Environment template
├── nest-cli.json                # NestJS CLI config
├── package.json                 # Dependencies
└── tsconfig.json                # TypeScript config
```

## Database Schema

### Updated Tables (from your existing schema)

- **customers**: Added `password_hash`, `phone`, `address`, `profile_image`, `status`
- **service_providers**: Added `password_hash`, `description`, `profile_image`, `average_rating`, `total_reviews`, `is_verified`, `status`
- **admins**: Added `email`, `password_hash`, `role`, `is_active`
- **services**: Added `description`, `icon`, `is_active`
- **provider_services**: Added `price`, `duration_minutes`, `description`, `is_active`
- **bookings**: Added `provider_id`, `service_id`, `status`, `notes`, `address`, `total_amount`
- **payments**: Added `booking_id`, `status`, `transaction_id`

### New Tables

- **reviews**: Customer reviews for providers
- **block_reports**: Block and report functionality
- **refresh_tokens**: JWT refresh token storage
- **chat_approvals**: Admin approval to open chat on a booking (migration 005)
- **chat_messages**: Customer <-> provider chat messages per booking (migration 005)

## Security Features

- Password hashing with bcrypt (10 rounds)
- JWT access tokens (15-minute expiry)
- Refresh tokens (7-day expiry)
- Role-based access control (RBAC)
- Input validation on all endpoints
- CORS configuration

## Development

```bash
# Run in watch mode
npm run start:dev

# Run tests
npm run test

# Build for production
npm run build
```

## Production Deployment

See [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md): server setup, environment
variables, the first admin account, nginx and HTTPS, backups and restore.

## License

MIT
