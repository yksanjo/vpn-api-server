const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// In-memory data store (would be file-based or database in production)
let data = {
  servers: [
    { id: '1', name: 'US Server 1', host: 'us1.vpn.com', port: 1194, protocol: 'OpenVPN', country: 'US', status: 'online' },
    { id: '2', name: 'UK Server 1', host: 'uk1.vpn.com', port: 51820, protocol: 'WireGuard', country: 'UK', status: 'online' },
    { id: '3', name: 'Japan Server 1', host: 'jp1.vpn.com', port: 500, protocol: 'IKEv2', country: 'JP', status: 'online' },
    { id: '4', name: 'Germany Server 1', host: 'de1.vpn.com', port: 1194, protocol: 'OpenVPN', country: 'DE', status: 'online' }
  ],
  rules: [
    { id: '1', name: 'Netflix US', pattern: '*.netflix.com', serverId: '1', priority: 100, enabled: true },
    { id: '2', name: 'BBC UK', pattern: '*.bbc.co.uk', serverId: '2', priority: 90, enabled: true }
  ],
  profiles: [
    { id: 'default', name: 'Default', defaultServer: '1', killSwitch: false, dns: '1.1.1.1' }
  ],
  connection: {
    connected: false,
    serverId: null,
    connectedAt: null,
    stats: { bytesIn: 0, bytesOut: 0 }
  },
  history: []
};

// Helper function to generate ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// ==================== SERVER ROUTES ====================

// Get all servers
app.get('/api/servers', (req, res) => {
  res.json({ success: true, data: data.servers });
});

// Get single server
app.get('/api/servers/:id', (req, res) => {
  const server = data.servers.find(s => s.id === req.params.id);
  if (server) {
    res.json({ success: true, data: server });
  } else {
    res.status(404).json({ success: false, error: 'Server not found' });
  }
});

// Add server
app.post('/api/servers', (req, res) => {
  const server = { id: generateId(), ...req.body, status: 'online' };
  data.servers.push(server);
  res.status(201).json({ success: true, data: server });
});

// Update server
app.put('/api/servers/:id', (req, res) => {
  const index = data.servers.findIndex(s => s.id === req.params.id);
  if (index !== -1) {
    data.servers[index] = { ...data.servers[index], ...req.body };
    res.json({ success: true, data: data.servers[index] });
  } else {
    res.status(404).json({ success: false, error: 'Server not found' });
  }
});

// Delete server
app.delete('/api/servers/:id', (req, res) => {
  data.servers = data.servers.filter(s => s.id !== req.params.id);
  res.json({ success: true });
});

// ==================== RULE ROUTES ====================

// Get all rules
app.get('/api/rules', (req, res) => {
  res.json({ success: true, data: data.rules });
});

// Add rule
app.post('/api/rules', (req, res) => {
  const rule = { id: generateId(), ...req.body, enabled: true };
  data.rules.push(rule);
  res.status(201).json({ success: true, data: rule });
});

// Delete rule
app.delete('/api/rules/:id', (req, res) => {
  data.rules = data.rules.filter(r => r.id !== req.params.id);
  res.json({ success: true });
});

// Toggle rule
app.patch('/api/rules/:id/toggle', (req, res) => {
  const rule = data.rules.find(r => r.id === req.params.id);
  if (rule) {
    rule.enabled = !rule.enabled;
    res.json({ success: true, data: rule });
  } else {
    res.status(404).json({ success: false, error: 'Rule not found' });
  }
});

// ==================== PROFILE ROUTES ====================

// Get all profiles
app.get('/api/profiles', (req, res) => {
  res.json({ success: true, data: data.profiles });
});

// Get active profile
app.get('/api/profiles/active', (req, res) => {
  res.json({ success: true, data: data.profiles[0] });
});

// ==================== CONNECTION ROUTES ====================

// Get connection status
app.get('/api/connection', (req, res) => {
  res.json({ success: true, data: data.connection });
});

// Connect to server
app.post('/api/connection/connect', (req, res) => {
  const { serverId } = req.body;
  const server = data.servers.find(s => s.id === serverId);
  
  if (!server) {
    return res.status(404).json({ success: false, error: 'Server not found' });
  }

  data.connection = {
    connected: true,
    serverId: server.id,
    serverName: server.name,
    connectedAt: new Date().toISOString(),
    stats: { bytesIn: 0, bytesOut: 0 }
  };

  // Add to history
  data.history.unshift({
    id: generateId(),
    type: 'connect',
    server: server.name,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, data: data.connection });
});

// Disconnect
app.post('/api/connection/disconnect', (req, res) => {
  if (data.connection.connected) {
    data.history.unshift({
      id: generateId(),
      type: 'disconnect',
      server: data.connection.serverName,
      timestamp: new Date().toISOString()
    });
  }

  data.connection = {
    connected: false,
    serverId: null,
    connectedAt: null,
    stats: { bytesIn: 0, bytesOut: 0 }
  };

  res.json({ success: true, data: data.connection });
});

// ==================== HISTORY ROUTES ====================

// Get connection history
app.get('/api/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json({ success: true, data: data.history.slice(0, limit) });
});

// Clear history
app.delete('/api/history', (req, res) => {
  data.history = [];
  res.json({ success: true });
});

// ==================== STATUS ROUTES ====================

// Get full status
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    data: {
      connection: data.connection,
      servers: data.servers,
      rules: data.rules,
      profiles: data.profiles,
      stats: {
        totalServers: data.servers.length,
        activeRules: data.rules.filter(r => r.enabled).length,
        historyCount: data.history.length
      }
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🔌 VPN API Server running on http://localhost:${PORT}`);
  console.log(`📋 API Endpoints:`);
  console.log(`   GET  /api/status`);
  console.log(`   GET  /api/servers`);
  console.log(`   POST /api/connection/connect`);
  console.log(`   POST /api/connection/disconnect`);
});
