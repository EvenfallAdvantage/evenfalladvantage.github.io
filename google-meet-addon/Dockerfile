# Use Node.js 18
FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY src/backend/package*.json ./

# Install dependencies
RUN npm install --production

# Copy app source
COPY src/backend/ .

# Expose port
EXPOSE 8080

# Set environment variable for port
ENV PORT=8080

# Start the app
CMD [ "node", "server.js" ]
