/**
 * AMI CONNECTION POOL - Asterisk Manager Interface Connection Pool
 * Manages multiple AMI connections with heartbeat and automatic failover
 */

const net = require('net');
const EventEmitter = require('events');

class AMIConnection extends EventEmitter {
  constructor(id, config) {
    super();
    this.id = id;
    this.config = config;
    this.socket = null;
    this.buffer = '';
    this.connected = false;
    this.authenticated = false;
    this.lastActivity = Date.now();
    this.heartbeatInterval = null;
    this.reconnectTimeout = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 2000;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      if (this.connected) {
        resolve();
        return;
      }

      console.log(`🔄 [AMI-${this.id}] Conectando ao ${this.config.host}:${this.config.port}...`);
      
      this.socket = new net.Socket();
      this.socket.setTimeout(30000); // 30s timeout

      this.socket.on('connect', () => {
        console.log(`✅ [AMI-${this.id}] Conectado`);
        this.connected = true;
        this.reconnectAttempts = 0;
        this.lastActivity = Date.now();
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Login no AMI
        this.sendAction({
          Action: 'Login',
          Username: this.config.username,
          Secret: this.config.password,
          Events: 'on'
        });
      });

      this.socket.on('data', (data) => {
        this.lastActivity = Date.now();
        this.parseAMIData(data);
      });

      this.socket.on('timeout', () => {
        console.warn(`⏰ [AMI-${this.id}] Timeout - reconectando...`);
        this.handleDisconnect();
      });

      this.socket.on('error', (err) => {
        console.error(`❌ [AMI-${this.id}] Erro:`, err.message);
        this.handleDisconnect();
        if (this.reconnectAttempts === 0) {
          reject(err);
        }
      });

      this.socket.on('close', () => {
        console.log(`🔌 [AMI-${this.id}] Conexão fechada`);
        this.handleDisconnect();
      });

      // Set initial resolve for first connection
      this.once('authenticated', () => {
        resolve();
      });

      this.socket.connect(this.config.port, this.config.host);
    });
  }

  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.connected && this.authenticated) {
        // Send ping to keep connection alive
        this.sendAction({
          Action: 'Ping',
          ActionID: `ping-${this.id}-${Date.now()}`
        });
      }
    }, 30000); // Ping every 30 seconds
  }

  handleDisconnect() {
    this.connected = false;
    this.authenticated = false;
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    this.emit('disconnected');
    this.scheduleReconnect();
  }

  scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`❌ [AMI-${this.id}] Máximo de tentativas de reconexão atingido`);
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, Math.min(this.reconnectAttempts - 1, 5)); // Exponential backoff
    
    console.log(`🔄 [AMI-${this.id}] Reagendando reconexão em ${delay}ms (tentativa ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(err => {
        console.error(`❌ [AMI-${this.id}] Falha na reconexão:`, err.message);
      });
    }, delay);
  }

  sendAction(action) {
    if (!this.connected || !this.socket) {
      throw new Error(`AMI-${this.id} não conectado`);
    }

    const message = Object.entries(action)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\r\n') + '\r\n\r\n';

    this.socket.write(message);
  }

  parseAMIData(data) {
    this.buffer += data.toString();
    const parts = this.buffer.split('\r\n\r\n');
    this.buffer = parts.pop();

    parts.forEach((part) => {
      const event = {};
      part.split('\r\n').forEach((line) => {
        const [key, value] = line.split(/: (.+)/);
        if (key && value) {
          event[key.trim()] = value.trim();
        }
      });

      if (event.Event) {
        this.emit('event', event);
      } else if (event.Response) {
        this.handleResponse(event);
      }
    });
  }

  handleResponse(response) {
    if (response.Response === 'Success' && response.Message?.includes('Authentication accepted')) {
      console.log(`✅ [AMI-${this.id}] Login realizado com sucesso`);
      this.authenticated = true;
      this.emit('authenticated');
    } else if (response.Response === 'Error') {
      console.error(`❌ [AMI-${this.id}] Erro na resposta:`, response.Message);
    }

    this.emit('response', response);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    this.connected = false;
    this.authenticated = false;
    console.log(`👋 [AMI-${this.id}] Desconectado`);
  }

  isHealthy() {
    const timeSinceLastActivity = Date.now() - this.lastActivity;
    return this.connected && this.authenticated && timeSinceLastActivity < 60000; // 1 minute
  }
}

class AMIConnectionPool extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      host: process.env.AMI_HOST || '38.51.135.180',
      port: parseInt(process.env.AMI_PORTE || process.env.AMI_PORT || '5038'),
      username: process.env.AMI_USER || 'admin',
      password: process.env.AMI_PASSWORD || '35981517',
      poolSize: config.poolSize || 3,
      ...config
    };

    this.connections = [];
    this.currentConnectionIndex = 0;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    console.log(`🔄 [AMI-Pool] Inicializando pool com ${this.config.poolSize} conexões...`);

    // Create connections
    for (let i = 0; i < this.config.poolSize; i++) {
      const connection = new AMIConnection(i + 1, this.config);
      
      connection.on('event', (event) => {
        this.emit('event', event);
      });

      connection.on('response', (response) => {
        this.emit('response', response);
      });

      connection.on('disconnected', () => {
        console.warn(`⚠️ [AMI-Pool] Conexão ${connection.id} desconectada`);
      });

      connection.on('maxReconnectAttemptsReached', () => {
        console.error(`❌ [AMI-Pool] Conexão ${connection.id} falhou permanentemente`);
        this.replaceConnection(connection);
      });

      this.connections.push(connection);
    }

    // Connect all connections
    const connectionPromises = this.connections.map(conn => 
      conn.connect().catch(err => {
        console.warn(`⚠️ [AMI-Pool] Falha ao conectar ${conn.id}:`, err.message);
        return null;
      })
    );

    await Promise.allSettled(connectionPromises);

    // Check if at least one connection is healthy
    const healthyConnections = this.getHealthyConnections();
    if (healthyConnections.length === 0) {
      throw new Error('Nenhuma conexão AMI saudável disponível');
    }

    console.log(`✅ [AMI-Pool] Pool inicializado com ${healthyConnections.length}/${this.config.poolSize} conexões saudáveis`);
    this.initialized = true;

    // Start health monitoring
    this.startHealthMonitoring();
  }

  getHealthyConnections() {
    return this.connections.filter(conn => conn.isHealthy());
  }

  getNextConnection() {
    const healthyConnections = this.getHealthyConnections();
    
    if (healthyConnections.length === 0) {
      throw new Error('Nenhuma conexão AMI saudável disponível');
    }

    // Round-robin selection
    this.currentConnectionIndex = (this.currentConnectionIndex + 1) % healthyConnections.length;
    return healthyConnections[this.currentConnectionIndex];
  }

  async sendAction(action) {
    if (!this.initialized) {
      await this.initialize();
    }

    const connection = this.getNextConnection();
    return connection.sendAction(action);
  }

  async replaceConnection(failedConnection) {
    const index = this.connections.indexOf(failedConnection);
    if (index === -1) return;

    console.log(`🔄 [AMI-Pool] Substituindo conexão ${failedConnection.id}...`);
    
    // Disconnect old connection
    failedConnection.disconnect();
    
    // Create new connection
    const newConnection = new AMIConnection(failedConnection.id, this.config);
    
    newConnection.on('event', (event) => {
      this.emit('event', event);
    });

    newConnection.on('response', (response) => {
      this.emit('response', response);
    });

    newConnection.on('disconnected', () => {
      console.warn(`⚠️ [AMI-Pool] Conexão ${newConnection.id} desconectada`);
    });

    newConnection.on('maxReconnectAttemptsReached', () => {
      console.error(`❌ [AMI-Pool] Conexão ${newConnection.id} falhou permanentemente`);
      this.replaceConnection(newConnection);
    });

    this.connections[index] = newConnection;

    try {
      await newConnection.connect();
      console.log(`✅ [AMI-Pool] Conexão ${newConnection.id} substituída com sucesso`);
    } catch (err) {
      console.error(`❌ [AMI-Pool] Falha ao substituir conexão ${newConnection.id}:`, err.message);
    }
  }

  startHealthMonitoring() {
    setInterval(() => {
      const healthyCount = this.getHealthyConnections().length;
      const totalCount = this.connections.length;
      
      if (healthyCount < totalCount) {
        console.warn(`⚠️ [AMI-Pool] Saúde: ${healthyCount}/${totalCount} conexões saudáveis`);
      }

      // Replace unhealthy connections
      this.connections.forEach(conn => {
        if (!conn.isHealthy() && !conn.reconnectTimeout) {
          this.replaceConnection(conn);
        }
      });
    }, 60000); // Check every minute
  }

  async disconnect() {
    console.log('🔄 [AMI-Pool] Desconectando todas as conexões...');
    
    const disconnectPromises = this.connections.map(conn => {
      return new Promise(resolve => {
        conn.disconnect();
        resolve();
      });
    });

    await Promise.all(disconnectPromises);
    this.initialized = false;
    console.log('👋 [AMI-Pool] Todas as conexões desconectadas');
  }

  getPoolStatus() {
    const healthyConnections = this.getHealthyConnections();
    return {
      total: this.connections.length,
      healthy: healthyConnections.length,
      connections: this.connections.map(conn => ({
        id: conn.id,
        connected: conn.connected,
        authenticated: conn.authenticated,
        lastActivity: conn.lastActivity,
        reconnectAttempts: conn.reconnectAttempts
      }))
    };
  }
}

module.exports = AMIConnectionPool;
