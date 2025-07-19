# Library Management System - Docker Setup Guide

This guide will help you deploy the Library Management System using Docker and Docker Compose.

## 📋 Prerequisites

- Docker Engine 20.10+ 
- Docker Compose 2.0+
- At least 2GB of available RAM
- At least 5GB of available disk space

## 🚀 Quick Start

### 1. Clone and Setup Environment

```bash
# Clone the repository (if not already done)
git clone <repository-url>
cd library-management-system

# Copy environment file and configure
cp .env.example .env
nano .env  # Edit configuration values
```

### 2. Production Deployment

```bash
# Start all services (with PostgreSQL database)
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 3. Development Deployment

```bash
# Start development services (with SQLite database)
docker-compose -f docker-compose.dev.yml up -d

# For hot-reload development
docker-compose -f docker-compose.dev.yml up
```

## 🏗️ Architecture Overview

### Services

| Service | Port | Description |
|---------|------|-------------|
| **client** | 3000 | React frontend application |
| **server** | 8000 | FastAPI backend application |
| **database** | 5432 | PostgreSQL database |
| **redis** | 6379 | Redis cache (optional) |
| **nginx** | 80/443 | Reverse proxy (optional) |
| **pgadmin** | 5050 | Database admin tool (optional) |

### Network Architecture

```
Internet → Nginx (80/443) → Client (3000)
                        ↘ Server (8000) → Database (5432)
                                       ↘ Redis (6379)
```

## ⚙️ Configuration

### Environment Variables

Key variables in `.env` file:

```bash
# Security
JWT_SECRET_KEY=your-secure-jwt-key
DB_PASSWORD=your-secure-db-password

# Ports
CLIENT_PORT=3000
SERVER_PORT=8000
DB_PORT=5432

# Environment
ENVIRONMENT=production
LOG_LEVEL=INFO
```

### Service Profiles

Use Docker Compose profiles to control which services to run:

```bash
# Start with cache (Redis)
docker-compose --profile cache up -d

# Start with reverse proxy (Nginx)
docker-compose --profile proxy up -d

# Start with database admin (pgAdmin)
docker-compose --profile admin up -d

# Start everything
docker-compose --profile cache --profile proxy --profile admin up -d
```

## 🗄️ Database Setup

### PostgreSQL (Production)

The production setup uses PostgreSQL with persistent volumes:

```bash
# Initialize database with sample data
docker-compose exec server python seed_data.py

# Backup database
docker-compose exec database pg_dump -U library_user library_db > backup.sql

# Restore database
docker-compose exec -T database psql -U library_user library_db < backup.sql
```

### SQLite (Development)

Development setup uses SQLite for simplicity:

```bash
# Access SQLite database
docker-compose -f docker-compose.dev.yml exec server sqlite3 library.db
```

## 📊 Monitoring and Logs

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f server
docker-compose logs -f client

# Follow new logs only
docker-compose logs -f --tail=50 server
```

### Health Checks

```bash
# Check service status
docker-compose ps

# Check individual service health
curl http://localhost:3000/health  # Client
curl http://localhost:8000/health  # Server
```

### Resource Usage

```bash
# View resource usage
docker stats

# View disk usage
docker system df
```

## 🔧 Development Workflow

### Hot Reload Development

```bash
# Start in development mode with source code mounting
docker-compose -f docker-compose.dev.yml up

# This enables:
# - Hot reload for React frontend
# - Auto-restart for FastAPI backend
# - SQLite database for simplicity
# - Debug logging enabled
```

### Database Operations

```bash
# Reset development database
docker-compose -f docker-compose.dev.yml exec server rm library.db
docker-compose -f docker-compose.dev.yml restart server

# Access development database
docker-compose -f docker-compose.dev.yml exec server python -c "
from database import get_session_context
from models import User
from sqlmodel import select

with get_session_context() as session:
    users = session.exec(select(User)).all()
    print(f'Total users: {len(users)}')
"
```

## 🔐 Security Considerations

### Production Security

1. **Change Default Passwords**
   ```bash
   # Generate secure passwords
   openssl rand -hex 32  # For JWT_SECRET_KEY
   openssl rand -hex 16  # For database passwords
   ```

2. **Use HTTPS**
   - Configure SSL certificates in nginx service
   - Update CLIENT_API_URL to use HTTPS

3. **Network Security**
   - Use Docker networks for service isolation
   - Limit exposed ports
   - Use firewall rules

4. **Database Security**
   - Use strong database passwords
   - Limit database connections
   - Regular backups

### File Permissions

```bash
# Set proper permissions for log directories
sudo chown -R $USER:$USER ./server/logs
chmod 755 ./server/logs

# Set permissions for uploads
mkdir -p ./server/uploads
chmod 755 ./server/uploads
```

## 🚨 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Check what's using the port
   sudo lsof -i :3000
   sudo lsof -i :8000
   
   # Stop conflicting services
   sudo systemctl stop nginx  # If running system nginx
   ```

2. **Database Connection Issues**
   ```bash
   # Check database logs
   docker-compose logs database
   
   # Test database connection
   docker-compose exec database pg_isready -U library_user
   ```

3. **Build Issues**
   ```bash
   # Clean build cache
   docker-compose build --no-cache
   
   # Remove old images
   docker system prune -a
   ```

4. **Permission Issues**
   ```bash
   # Fix file permissions
   sudo chown -R $USER:$USER .
   
   # Fix volume permissions
   docker-compose exec server chown -R python:python /app/logs
   ```

### Debug Commands

```bash
# Enter service container
docker-compose exec server bash
docker-compose exec client sh

# Check service configuration
docker-compose config

# Validate compose file
docker-compose config --quiet
```

## 📈 Scaling and Performance

### Horizontal Scaling

```bash
# Scale server instances
docker-compose up -d --scale server=3

# Use with load balancer (nginx)
docker-compose --profile proxy up -d --scale server=3
```

### Performance Tuning

1. **Database Optimization**
   - Adjust PostgreSQL settings in compose file
   - Use connection pooling
   - Add database indices

2. **Caching**
   - Enable Redis profile
   - Configure application caching

3. **Resource Limits**
   ```yaml
   # Add to service definition
   deploy:
     resources:
       limits:
         cpus: '2'
         memory: 1G
       reservations:
         cpus: '0.5'
         memory: 512M
   ```

## 🔄 Backup and Recovery

### Automated Backups

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T database pg_dump -U library_user library_db > backup_${DATE}.sql
find . -name "backup_*.sql" -mtime +7 -delete  # Keep backups for 7 days
EOF

chmod +x backup.sh

# Add to crontab
echo "0 2 * * * /path/to/backup.sh" | crontab -
```

### Volume Backups

```bash
# Backup persistent volumes
docker run --rm \
  -v library-management-system_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres_backup.tar.gz -C /data .
```

## 🎯 Production Deployment Checklist

- [ ] Updated all passwords in `.env`
- [ ] Configured SSL certificates
- [ ] Set up automated backups
- [ ] Configured monitoring
- [ ] Set resource limits
- [ ] Tested disaster recovery
- [ ] Set up log rotation
- [ ] Configured firewall rules
- [ ] Tested all application features
- [ ] Set up health monitoring

## 📞 Support

For issues and questions:

1. Check the logs: `docker-compose logs -f`
2. Review this documentation
3. Check Docker and application health
4. Verify network connectivity between services

## 🔗 Useful Commands Quick Reference

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart specific service
docker-compose restart server

# View logs
docker-compose logs -f server

# Execute command in service
docker-compose exec server python --version

# Clean up
docker-compose down -v --remove-orphans
docker system prune -a
```