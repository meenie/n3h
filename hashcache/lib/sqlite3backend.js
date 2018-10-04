const sqlite3 = require('./sqlite3')

/**
 * sqlite3 persistence engine for hashcache
 */
class Sqlite3Backend {
  /**
   * don't use this, see `await connect()`
   */
  constructor (db) {
    this._db = db
    this._ns = new Map()
  }

  /**
   * initialize a sqlite3 persistence backend
   * @param {object} opt
   * @param {string} opt.file - the sqlite3 db file
   */
  static async connect (opt) {
    opt || (opt = {})
    if (!opt.file) {
      throw new Error('cannot initialize a hashcache without a sqlite3 file')
    }

    return new Sqlite3Backend(await sqlite3.Db.connect(opt.file))
  }

  /**
   * get a value from the database
   * @param {string} ns - the namespace
   * @param {string} hash - the base64 encoded 32 byte hash
   */
  async get (ns, hash) {
    ns = await this._assertTable(ns)
    const res = await ns.getter.get(Buffer.from(hash, 'base64'))
    if (!res) {
      throw new Error('no data at ' + hash)
    }
    return res.data
  }

  /**
   * set a value in the database
   * @param {string} ns - the namespace
   * @param {string} hash - the base64 encoded 32 byte hash
   * @param {Buffer} data - the data to store
   */
  async set (ns, hash, data) {
    ns = await this._assertTable(ns)
    await ns.setter.run(
      Buffer.from(hash, 'base64'),
      data)
  }

  // -- private -- //

  /**
   * prepare a table and associated getter/setters
   * @private
   */
  async _assertTable (ns) {
    if (this._ns.has(ns)) {
      return this._ns.get(ns)
    }

    await this._db.run(`
      CREATE TABLE IF NOT EXISTS data_${ns} (
        hash BLOB PRIMARY KEY NOT NULL,
        data BLOB NOT NULL
      );
    `)

    this._ns.set(ns, {
      getter: await this._db.prepare(`
        SELECT hash, data
          FROM data_${ns}
          WHERE hash = ?1;
      `),
      setter: await this._db.prepare(`
        INSERT
          INTO data_${ns} (hash, data)
          VALUES (?1, ?2)
          ON CONFLICT (hash) DO UPDATE
            SET data = ?2;
      `)
    })

    return this._ns.get(ns)
  }
}

exports.Sqlite3Backend = Sqlite3Backend
