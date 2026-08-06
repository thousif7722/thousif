#!/bin/bash
# ==============================================================================
# ServiceHub — EC2 One-Click Production Deployment Script
# OS Target: Ubuntu 22.04 / 24.04 LTS
# ==============================================================================

set -e

echo "=============================================================================="
echo "🚀 Starting ServiceHub Automated EC2 Production Deployment"
echo "=============================================================================="

# 1. Update system packages
echo "📦 Step 1/6: Updating system packages..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg lsb-release git unzip certbot python3-certbot-nginx

# 2. Install Docker & Docker Compose Plugin (if not installed)
if ! command -v docker &> /dev/null; then
    echo "🐳 Step 2/6: Installing Docker Engine & Docker Compose Plugin..."
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker $USER
    echo "✅ Docker installed successfully."
else
    echo "✅ Docker is already installed."
fi

# 3. Setup Project Directory
PROJECT_DIR="$HOME/servicehub"
echo "📁 Step 3/6: Setting up project repository at $PROJECT_DIR..."

if [ -d "$PROJECT_DIR/.git" ]; then
    echo "🔄 Repository directory exists. Fetching latest changes from git..."
    cd "$PROJECT_DIR"
    git pull origin main || git pull
else
    if [ "$PWD" != "$PROJECT_DIR" ]; then
        echo "📥 Cloning ServiceHub repository..."
        git clone https://github.com/thousif7722/servicehub.git "$PROJECT_DIR"
        cd "$PROJECT_DIR"
    fi
fi

# 4. Generate .env Configuration file if missing
echo "⚙️ Step 4/6: Checking environment configuration (.env)..."
if [ ! -f ".env" ]; then
    echo "📄 Creating default production .env file..."
    cat << 'EOF' > .env
# Application Settings
NODE_ENV=production
PORT=5000

# Database & Cache
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/servicehub?retryWrites=true&w=majority
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=servicehub_redis_123

# JWT Authentication
JWT_SECRET=prod_jwt_secret_key_change_me_987654321
JWT_REFRESH_SECRET=prod_jwt_refresh_secret_key_change_me_987654321

# Payment Gateway (Razorpay)
RAZORPAY_KEY_ID=rzp_live_xxxxxx
RAZORPAY_KEY_SECRET=xxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxx

# Media Uploads (Cloudinary)
CLOUDINARY_CLOUD_NAME=xxxxxx
CLOUDINARY_API_KEY=xxxxxx
CLOUDINARY_API_SECRET=xxxxxx

# CORS & Gateway
ALLOWED_ORIGINS=*
VITE_API_URL=http://localhost:5000
EOF
    echo "⚠️ Generated template .env file. Please edit .env with your real API credentials using: nano .env"
else
    echo "✅ Existing .env file found."
fi

# 5. Build and Launch Containers with Docker Compose
echo "🏗️ Step 5/6: Building & Launching Docker containers with docker-compose.prod.yml..."
sudo docker compose -f docker-compose.prod.yml up -d --build

# 6. Verify Container Status
echo "📊 Step 6/6: Verifying container health status..."
sudo docker compose -f docker-compose.prod.yml ps

echo "=============================================================================="
echo "🎉 SUCCESS: ServiceHub successfully deployed on EC2!"
echo ""
echo "📌 Useful Commands:"
echo "   - View logs:   sudo docker compose -f docker-compose.prod.yml logs -f"
echo "   - Restart app: sudo docker compose -f docker-compose.prod.yml restart"
echo "   - Stop app:    sudo docker compose -f docker-compose.prod.yml down"
echo "=============================================================================="
