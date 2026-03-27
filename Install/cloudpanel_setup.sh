#!/bin/bash
# Webby - Safe CloudPanel Deployment Script
# This builds /var/www/webby, moves out files safely, 
# and Configures Systemd services without breaking CloudPanel.

echo "======================================"
echo " Webby CloudPanel Safe Installer"
echo "======================================"

if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (use sudo)" 
   exit 1
fi

echo -n "Enter your CloudPanel Site User exactly (e.g. you created in CP dashboard): "
read CLP_USER
if ! id "$CLP_USER" &>/dev/null; then
    echo "User $CLP_USER does not exist. Please create the site in CloudPanel first!"
    exit 1
fi

# Set directories
WEBBY_DIR="/var/www/webby/Install"
BUILDER_DIR="/var/www/webby/Builder"
SCRIPT_DIR="$(pwd)"

# Move files safely
echo "Structuring Webby files into /var/www/webby..."
mkdir -p /var/www/webby
mkdir -p "$WEBBY_DIR"
mkdir -p "$BUILDER_DIR"

if [[ -d "$SCRIPT_DIR/Install" ]]; then
    cp -r "$SCRIPT_DIR/Install"/* "$WEBBY_DIR/"
    cp -r "$SCRIPT_DIR/Builder"/* "$BUILDER_DIR/"
else
    cp -r "$SCRIPT_DIR"/* "$WEBBY_DIR/"
fi

# Set proper CloudPanel specific permissions
echo "Setting correct CloudPanel Ownership and Permissions..."
chown -R $CLP_USER:$CLP_USER /var/www/webby
chmod -R 775 "$WEBBY_DIR/storage"
chmod -R 775 "$WEBBY_DIR/bootstrap/cache"

# Create SystemD Services for the Background Daemons
echo "Creating Background Service for Laravel Queue..."
cat <<EOF > /etc/systemd/system/webby-queue.service
[Unit]
Description=Webby Laravel Queue Worker
After=network.target

[Service]
User=$CLP_USER
Group=$CLP_USER
Restart=always
ExecStart=/usr/bin/php8.2 $WEBBY_DIR/artisan queue:work --tries=3

[Install]
WantedBy=multi-user.target
EOF

echo "Creating Background Service for Laravel Reverb..."
cat <<EOF > /etc/systemd/system/webby-reverb.service
[Unit]
Description=Webby Laravel Reverb Server
After=network.target

[Service]
User=$CLP_USER
Group=$CLP_USER
Restart=always
ExecStart=/usr/bin/php8.2 $WEBBY_DIR/artisan reverb:start

[Install]
WantedBy=multi-user.target
EOF

echo "Creating Background Service for Webby Builder..."
cat <<EOF > /etc/systemd/system/webby-builder.service
[Unit]
Description=Webby Go Builder Server
After=network.target

[Service]
User=$CLP_USER
Group=$CLP_USER
WorkingDirectory=$BUILDER_DIR/prebuilt
Restart=always
# NOTE: Using the Linux prebuilt binary at port 8891
ExecStart=$BUILDER_DIR/prebuilt/webby-builder-linux --port=8891

[Install]
WantedBy=multi-user.target
EOF

# Activate and boot services automatically
systemctl daemon-reload
systemctl enable webby-queue
systemctl enable webby-reverb
systemctl enable webby-builder
systemctl restart webby-queue
systemctl restart webby-reverb
systemctl restart webby-builder

echo "======================================"
echo " Webby Backend Services Installed! "
echo "======================================"
