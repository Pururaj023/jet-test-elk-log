const { Client } = require("@elastic/elasticsearch");

let client = null;
let isConnected = false;

const getClient = () => {
  if (!client) {
    const config = {
      node: process.env.ELASTICSEARCH_NODE || "http://localhost:9200",
    };

    // Support API Key auth (Elastic Cloud)
    if (process.env.ELASTICSEARCH_API_KEY) {
      config.auth = { apiKey: process.env.ELASTICSEARCH_API_KEY };
    }
    // Support username/password auth
    else if (process.env.ELASTICSEARCH_USERNAME) {
      config.auth = {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD,
      };
    }

    // Allow self-signed certs in dev
    if (process.env.NODE_ENV !== "production") {
      config.tls = { rejectUnauthorized: false };
    }

    client = new Client(config);
  }
  return client;
};

const initElasticsearch = async () => {
  try {
    const es = getClient();
    await es.ping();
    isConnected = true;
    console.log("✅ Elasticsearch connected successfully");

    // Create indices if they don't exist
    await createIndices(es);
  } catch (err) {
    isConnected = false;
    console.warn(
      "⚠️  Elasticsearch not available - logs will be stored in memory only"
    );
    console.warn(`   Reason: ${err.message}`);
  }
};

const createIndices = async (es) => {
  const indices = [
    {
      name: "jet-game-logs",
      mappings: {
        properties: {
          "@timestamp": { type: "date" },
          level: { type: "keyword" },
          event: { type: "keyword" },
          userId: { type: "keyword" },
          username: { type: "keyword" },
          message: { type: "text" },
          data: { type: "object", dynamic: true },
          ip: { type: "ip" },
          userAgent: { type: "text" },
        },
      },
    },
    {
      name: "jet-game-scores",
      mappings: {
        properties: {
          "@timestamp": { type: "date" },
          userId: { type: "keyword" },
          username: { type: "keyword" },
          score: { type: "integer" },
          duration: { type: "integer" },
          obstaclesAvoided: { type: "integer" },
          level: { type: "integer" },
        },
      },
    },
  ];

  for (const index of indices) {
    const exists = await es.indices.exists({ index: index.name });
    if (!exists) {
      await es.indices.create({
        index: index.name,
        mappings: index.mappings,
      });
      console.log(`📋 Created Elasticsearch index: ${index.name}`);
    }
  }
};

// In-memory fallback log store
const memoryLogs = [];

const sendLog = async (logData) => {
  const doc = {
    "@timestamp": new Date().toISOString(),
    ...logData,
  };

  // Always store in memory
  memoryLogs.push(doc);
  if (memoryLogs.length > 1000) memoryLogs.shift(); // Keep last 1000

  // Try to send to Elasticsearch
  if (isConnected) {
    try {
      const es = getClient();
      await es.index({
        index: "jet-game-logs",
        document: doc,
      });
    } catch (err) {
      console.error("Failed to send log to ES:", err.message);
      isConnected = false; // Mark as disconnected
    }
  }

  return doc;
};

const sendScore = async (scoreData) => {
  const doc = {
    "@timestamp": new Date().toISOString(),
    ...scoreData,
  };

  if (isConnected) {
    try {
      const es = getClient();
      await es.index({
        index: "jet-game-scores",
        document: doc,
      });
    } catch (err) {
      console.error("Failed to send score to ES:", err.message);
    }
  }

  return doc;
};

const getRecentLogs = async (size = 50) => {
  if (isConnected) {
    try {
      const es = getClient();
      const result = await es.search({
        index: "jet-game-logs",
        size,
        sort: [{ "@timestamp": { order: "desc" } }],
      });
      return result.hits.hits.map((h) => h._source);
    } catch (err) {
      console.error("Failed to fetch logs from ES:", err.message);
    }
  }
  // Fallback to memory
  return [...memoryLogs].reverse().slice(0, size);
};

const getElasticsearchStatus = () => ({ isConnected, memoryLogCount: memoryLogs.length });

module.exports = { initElasticsearch, sendLog, sendScore, getRecentLogs, getElasticsearchStatus };