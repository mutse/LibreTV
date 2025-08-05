let db;

export async function initDatabase(env = null) {
  // 检查是否在 Cloudflare Workers 环境中
  const isCloudflareWorkers = typeof globalThis !== 'undefined' && 
    globalThis.Request && 
    globalThis.Response && 
    globalThis.fetch;
  
  if (isCloudflareWorkers || env?.DB) {
    // Cloudflare Workers 环境 - 使用 D1
    db = env?.DB || globalThis.DB;
    if (!db) {
      throw new Error('DB binding not found in Cloudflare Workers environment. Please check wrangler.toml configuration.');
    }
    console.log('Connected to Cloudflare D1 database');
  } else {
    // 本地开发 - 用 sqlite3 (ESM 动态导入)
    const sqlite3Module = await import('sqlite3');
    const sqlite3 = sqlite3Module.default.verbose();
    const dbPath = process.env.D1_DATABASE_PATH || './dev-database.db';
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('Connected to SQLite database at:', dbPath);
      }
    });
  }
  return db;
}

export function getDatabase() {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

// 执行数据库查询的辅助函数
export async function executeQuery(query, params = []) {
  const database = getDatabase();
  
  // 检查是否在 Cloudflare Workers 环境中
  const isCloudflareWorkers = typeof globalThis !== 'undefined' && 
    globalThis.Request && 
    globalThis.Response && 
    globalThis.fetch;
  
  if (isCloudflareWorkers || database.prepare) {
    // Cloudflare D1 环境
    try {
      const stmt = database.prepare(query);
      const result = await stmt.bind(...params).all();
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  } else {
    // 本地开发 - SQLite3
    return new Promise((resolve, reject) => {
      database.all(query, params, (err, rows) => {
        if (err) {
          console.error('Database query error:', err);
          reject(err);
        } else {
          resolve({ results: rows });
        }
      });
    });
  }
}

// 执行单行查询
export async function executeQueryFirst(query, params = []) {
  const database = getDatabase();
  
  // 检查是否在 Cloudflare Workers 环境中
  const isCloudflareWorkers = typeof globalThis !== 'undefined' && 
    globalThis.Request && 
    globalThis.Response && 
    globalThis.fetch;
  
  if (isCloudflareWorkers || database.prepare) {
    // Cloudflare D1 环境
    try {
      const stmt = database.prepare(query);
      const result = await stmt.bind(...params).first();
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  } else {
    // 本地开发 - SQLite3
    return new Promise((resolve, reject) => {
      database.get(query, params, (err, row) => {
        if (err) {
          console.error('Database query error:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
}

// 执行数据库修改操作（INSERT, UPDATE, DELETE）
export async function executeUpdate(query, params = []) {
  const database = getDatabase();
  
  // 检查是否在 Cloudflare Workers 环境中
  const isCloudflareWorkers = typeof globalThis !== 'undefined' && 
    globalThis.Request && 
    globalThis.Response && 
    globalThis.fetch;
  
  if (isCloudflareWorkers || database.prepare) {
    // Cloudflare D1 环境
    try {
      const stmt = database.prepare(query);
      const result = await stmt.bind(...params).run();
      return {
        success: true,
        meta: { last_row_id: result.meta.last_row_id }
      };
    } catch (error) {
      console.error('Database update error:', error);
      throw error;
    }
  } else {
    // 本地开发 - SQLite3
    return new Promise((resolve, reject) => {
      database.run(query, params, function (err) {
        if (err) {
          console.error('Database update error:', err);
          reject(err);
        } else {
          resolve({
            success: true,
            meta: { last_row_id: this.lastID }
          });
        }
      });
    });
  }
}

// 初始化数据库表结构
export async function initTables() {
  // 检查是否在 Cloudflare Workers 环境中
  const isCloudflareWorkers = typeof globalThis !== 'undefined' && 
    globalThis.Request && 
    globalThis.Response && 
    globalThis.fetch;
  
  if (isCloudflareWorkers) {
    console.log('Skipping table initialization in Cloudflare Workers. Schema should be managed via Wrangler migrations.');
    console.log('Run: wrangler d1 migrations apply libretv --remote');
    return;
  }

  const database = getDatabase();
  try {
    // 读取SQL schema文件并整体执行
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      // 直接整体执行 schema 内容
      await new Promise((resolve, reject) => {
        database.exec(schema, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('Database tables initialized successfully');
    } else {
      console.warn('Database schema file not found, skipping table initialization');
    }
  } catch (error) {
    console.error('Error initializing database tables:', error);
    throw error;
  }
}

export default {
  initDatabase,
  getDatabase,
  executeQuery,
  executeQueryFirst,
  executeUpdate,
  initTables
};