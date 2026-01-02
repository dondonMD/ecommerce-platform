# E-Commerce Platform

A modern, full-stack e-commerce platform built with React 19, TypeScript, Express, tRPC, MySQL, and Redis. Features include user authentication, product management, shopping cart, secure payments with Stripe, AI-powered features, and comprehensive admin tools.

## 🚀 Features

### Core E-Commerce Features

- **User Authentication**: OAuth integration with secure session management
- **Product Management**: Dynamic product catalog with image uploads
- **Shopping Cart**: Persistent cart with real-time updates
- **Secure Payments**: Stripe integration with webhook verification
- **Order Management**: Complete order lifecycle tracking
- **Admin Dashboard**: Comprehensive admin tools and analytics

### Advanced Features

- **AI Integration**: Chat support and product recommendations
- **Real-time Notifications**: WebSocket-based notifications
- **File Storage**: AWS S3 integration for secure file uploads
- **Rate Limiting**: DDoS protection and abuse prevention
- **Comprehensive Testing**: Full test coverage with Vitest
- **Accessibility**: WCAG 2.1 AA compliant with ARIA support

### Technical Features

- **Type Safety**: End-to-end TypeScript with tRPC
- **Performance**: Redis caching and optimized queries
- **Security**: CSRF protection, input validation, secure headers
- **Scalability**: Docker containerization and cloud-ready deployment
- **Monitoring**: Comprehensive logging and error tracking

## 🛠️ Tech Stack

### Frontend

- **React 19** - Modern React with concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS v4** - Utility-first CSS framework
- **shadcn/ui** - Accessible component library
- **Radix UI** - Unstyled, accessible UI primitives

### Backend

- **Express.js** - Fast, unopinionated web framework
- **tRPC** - End-to-end typesafe APIs
- **MySQL** - Relational database
- **Drizzle ORM** - Type-safe SQL queries
- **Redis** - High-performance caching and sessions

### External Services

- **Stripe** - Payment processing
- **AWS S3** - File storage
- **OAuth Providers** - Social authentication

### Development Tools

- **Vitest** - Fast unit testing
- **Docker** - Containerization
- **ESLint** - Code linting
- **Prettier** - Code formatting

## 📋 Prerequisites

- **Node.js**: Version 20.19+ or 22.12+
- **pnpm**: Package manager
- **Docker**: For local development
- **MySQL**: Database server
- **Redis**: Caching server

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ecommerce-platform
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Setup

Copy the environment template and configure your variables:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Database
DATABASE_URL=mysql://user:password@localhost:3306/ecommerce

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
SESSION_SECRET=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Payments
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# File Storage
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_S3_BUCKET_NAME=your-bucket-name
AWS_REGION=us-east-1

# AI Features (Optional)
OPENAI_API_KEY=sk-...
```

### 4. Start Development Environment

```bash
# Start all services (MySQL, Redis)
docker-compose up -d

# Run database migrations
pnpm run db:migrate

# Start development server
pnpm run dev
```

The application will be available at `http://localhost:3000`

## 📁 Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/           # Utility libraries
│   │   ├── pages/         # Page components
│   │   └── main.tsx       # Application entry point
│   └── index.html
├── server/                 # Backend Express application
│   ├── _core/             # Core server functionality
│   ├── routers/           # tRPC route handlers
│   └── index.ts           # Server entry point
├── drizzle/               # Database schema and migrations
│   ├── schema.ts          # Database schema definitions
│   ├── relations.ts       # Table relationships
│   └── migrations/        # SQL migration files
├── shared/                # Shared types and constants
└── docs/                  # Documentation
```

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e
```

## 🏗️ Building for Production

```bash
# Build the application
pnpm run build

# Preview production build
pnpm run preview
```

## 🚢 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive deployment instructions.

### Quick Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Or use the provided deployment script
./scripts/deploy.sh
```

## 🔒 Security

See [SECURITY.md](./SECURITY.md) for security best practices and guidelines.

## 🔧 Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

## 📚 API Documentation

### tRPC Routes

The API is fully typed with tRPC. Key endpoints include:

- `auth.*` - Authentication routes
- `products.*` - Product management
- `cart.*` - Shopping cart operations
- `orders.*` - Order management
- `admin.*` - Administrative functions
- `system.*` - System health and utilities

### Webhook Endpoints

- `POST /api/webhooks/stripe` - Stripe payment webhooks

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Write tests for new features
- Update documentation as needed
- Ensure accessibility compliance
- Follow conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) for the component library
- [tRPC](https://trpc.io/) for type-safe APIs
- [Drizzle ORM](https://orm.drizzle.team/) for database operations
- [Stripe](https://stripe.com/) for payment processing
- [Tailwind CSS](https://tailwindcss.com/) for styling

## 📞 Support

For support, please:

1. Check the [troubleshooting guide](./TROUBLESHOOTING.md)
2. Search existing [issues](https://github.com/your-repo/issues)
3. Create a new issue with detailed information

## 🗺️ Roadmap

- [ ] Mobile app (React Native)
- [ ] Multi-language support (i18n)
- [ ] Advanced analytics dashboard
- [ ] Inventory management system
- [ ] Loyalty program integration
- [ ] Social commerce features
- [ ] Advanced AI recommendations
- [ ] Real-time chat support
- [ ] Progressive Web App (PWA)
- [ ] Multi-tenant architecture
