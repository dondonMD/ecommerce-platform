# Troubleshooting Guide

## Overview

This guide helps diagnose and resolve common issues with the e-commerce platform.

## Development Environment Issues

### Build Errors

#### Node.js Version Issues

**Error**: `Vite requires Node.js version 20.19+ or 22.12+`

**Solution**:

```bash
# Check current version
node --version

# Update Node.js (using nvm)
nvm install 20
nvm use 20

# Or download from nodejs.org
```

#### TypeScript Compilation Errors

**Error**: `Cannot find module` or type errors

**Solutions**:

```bash
# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Clear TypeScript cache
npx tsc --build --clean

# Check tsconfig.json paths
# Ensure all imports use correct aliases
```

#### Tailwind CSS Issues

**Error**: `tailwindcss` PostCSS plugin error

**Solution**:

```bash
# Install correct PostCSS plugin for Tailwind v4
pnpm add -D @tailwindcss/postcss

# Update postcss.config.js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};
```

### Database Issues

#### Connection Refused

**Error**: `ER_ACCESS_DENIED_ERROR` or connection refused

**Solutions**:

```bash
# Start MySQL container
docker-compose up -d mysql

# Check if MySQL is running
docker ps | grep mysql

# Verify DATABASE_URL in .env
echo $DATABASE_URL

# Test connection
pnpm exec drizzle-kit check
```

#### Migration Errors

**Error**: Migration files not applying

**Solution**:

```bash
# Generate migrations
pnpm run db:generate

# Apply migrations
pnpm run db:migrate

# Push schema (development only)
pnpm run db:push
```

### Redis Issues

**Error**: Redis connection failed

**Solutions**:

```bash
# Start Redis container
docker-compose up -d redis

# Check if Redis is running
docker ps | grep redis

# Test connection
redis-cli ping
```

## Runtime Issues

### Authentication Problems

#### OAuth Callback Issues

**Error**: OAuth login not working

**Debug Steps**:

1. Check OAuth credentials in `.env`
2. Verify redirect URI matches OAuth app settings
3. Check browser console for errors
4. Verify OAuth provider status

#### Session Issues

**Error**: User logged out unexpectedly

**Debug Steps**:

1. Check cookie settings
2. Verify SESSION_SECRET is set
3. Check cookie domain settings for production
4. Verify Redis is accessible for session storage

### API Issues

#### tRPC Errors

**Error**: `TRPCClientError` or network errors

**Debug Steps**:

```bash
# Check server logs
tail -f logs/app.log

# Test API endpoint directly
curl http://localhost:3000/api/trpc/system.health

# Check CORS settings
# Verify API routes are correct
```

#### Rate Limiting

**Error**: `Too many requests` error

**Debug Steps**:

1. Check rate limit configuration
2. Verify IP address isn't blocked
3. Check Redis connectivity for rate limiting
4. Review recent request patterns

### Payment Issues

#### Stripe Webhook Failures

**Error**: Webhooks not processing

**Debug Steps**:

```bash
# Check webhook endpoint
curl -X POST https://yourdomain.com/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Verify webhook secret
echo $STRIPE_WEBHOOK_SECRET

# Check Stripe dashboard for webhook attempts
# Review server logs for webhook processing
```

#### Payment Intent Errors

**Error**: Payment failed

**Debug Steps**:

1. Check Stripe dashboard for payment details
2. Verify API keys are correct
3. Check payment method configuration
4. Review client-side payment form

### File Upload Issues

#### S3 Upload Failures

**Error**: File upload failed

**Debug Steps**:

```bash
# Check AWS credentials
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY

# Verify S3 bucket permissions
aws s3 ls s3://$AWS_S3_BUCKET_NAME

# Check file size limits
ls -lh uploaded-file.jpg

# Review server logs for upload errors
```

## Production Issues

### Deployment Problems

#### Build Failures

**Error**: Build fails in production

**Solutions**:

```bash
# Check Node.js version on deployment platform
node --version

# Verify all environment variables are set
env | grep -E "(DATABASE|REDIS|STRIPE|AWS)"

# Check build logs for specific errors
# Ensure all dependencies are in package.json
```

#### Database Connection Issues

**Error**: Production database connection failed

**Solutions**:

1. Verify connection string format
2. Check firewall rules
3. Ensure SSL is properly configured
4. Verify database server is accessible

### Performance Issues

#### Slow Page Loads

**Debug Steps**:

```bash
# Check server response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000

# Monitor database query performance
# Check Redis cache hit rates
# Review bundle size
npm run build && ls -lh dist/
```

#### Memory Leaks

**Debug Steps**:

```bash
# Monitor memory usage
top -p $(pgrep node)

# Check for memory leaks in application code
# Review dependency usage
# Implement proper cleanup in components
```

### SSL/TLS Issues

#### Certificate Problems

**Error**: SSL certificate errors

**Solutions**:

1. Verify certificate installation
2. Check certificate expiration
3. Ensure correct domain configuration
4. Test SSL configuration with SSL Labs

## Monitoring and Logs

### Log Analysis

```bash
# View application logs
tail -f logs/app.log

# Search for specific errors
grep "ERROR" logs/app.log

# Monitor request patterns
tail -f logs/access.log | grep "POST"
```

### Health Checks

```bash
# Application health check
curl http://localhost:3000/health

# Database connectivity
curl http://localhost:3000/api/trpc/system.health

# External service checks
curl https://api.stripe.com/v1/charges -u $STRIPE_SECRET_KEY:
```

## Common Error Codes

### HTTP Status Codes

- **400 Bad Request**: Check input validation
- **401 Unauthorized**: Verify authentication
- **403 Forbidden**: Check permissions
- **404 Not Found**: Verify URL/routes
- **429 Too Many Requests**: Rate limiting triggered
- **500 Internal Server Error**: Check server logs

### Database Error Codes

- **ER_ACCESS_DENIED_ERROR**: Check database credentials
- **ER_BAD_DB_ERROR**: Verify database name
- **ER_PARSE_ERROR**: Check SQL syntax
- **ER_DUP_ENTRY**: Handle duplicate entries

### Stripe Error Codes

- **card_declined**: Payment method issue
- **insufficient_funds**: Customer balance issue
- **generic_decline**: General decline

## Emergency Procedures

### Service Outage

1. **Assess Impact**: Determine affected services
2. **Check Monitoring**: Review error rates and performance
3. **Rollback if Needed**: Deploy previous working version
4. **Communicate**: Inform users of the issue
5. **Investigate**: Analyze logs for root cause
6. **Fix and Test**: Implement fix and test thoroughly
7. **Deploy**: Roll forward with the fix

### Data Loss

1. **Stop the Bleeding**: Prevent further data loss
2. **Assess Damage**: Determine what data was lost
3. **Restore from Backup**: Use most recent clean backup
4. **Verify Integrity**: Check restored data
5. **Update Procedures**: Improve backup processes

### Security Incident

1. **Isolate**: Disconnect affected systems
2. **Assess**: Determine breach scope
3. **Contain**: Prevent further damage
4. **Notify**: Inform relevant parties
5. **Recover**: Restore clean systems
6. **Learn**: Update security measures

## Support Resources

### Internal Resources

- Application documentation
- Team knowledge base
- Previous incident reports
- Code repository issues

### External Resources

- [Node.js Documentation](https://nodejs.org/docs/)
- [Express.js Guide](https://expressjs.com/guide/)
- [Stripe Documentation](https://stripe.com/docs)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [MySQL Documentation](https://dev.mysql.com/doc/)

### Getting Help

1. Check this troubleshooting guide
2. Review application logs
3. Search existing issues in repository
4. Contact development team
5. Escalate to infrastructure team if needed
