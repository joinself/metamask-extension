import SelfConnect from './SelfConnect';

const EventEmitter = require('events').EventEmitter;
const keyringType = "self"

class SelfKeyring extends EventEmitter {
  constructor (opts={}) {
    super()
    this.type = keyringType;
    this._resetDefaults();
    this.deserialize(opts);
  }

  //-------------------------------------------------------------------
  // Keyring API (per `https://github.com/MetaMask/eth-simple-keyring`)
  //-------------------------------------------------------------------
  async deserialize (opts = {}) {
    if (opts.hdPath)
      this.hdPath = opts.hdPath;
    if (opts.creds)
      this.creds = opts.creds;
    if (opts.accounts)
      this.accounts = opts.accounts;
    if (opts.accountIndices)
      this.accountIndices = opts.accountIndices;
    if (opts.accountOpts)
      this.accountOpts = opts.accountOpts;
    if (opts.walletUID)
      this.walletUID = opts.walletUID;
    if (opts.name)  // Legacy; use is deprecated and appName is more descriptive
      this.appName = opts.name;
    if (opts.appName)
      this.appName = opts.appName;
    if (opts.network)
      this.network = opts.network;
    if (opts.page)
      this.page = opts.page;
    return;
  }

  _resetDefaults() {
    this.accounts = [];
    this.accountIndices = [];
    this.accountOpts = [];
    this.isLocked = true;
    this.creds = {
      deviceID: null,
      password: null,
      endpoint: null,
    };
    this.walletUID = null;
    this.sdkSession = null;
    this.page = 0;
    this.unlockedAccount = 0;
    this.network = null;
    // this.hdPath = STANDARD_HD_PATH;
  }


  getAccounts() {
    return this.accounts ? [...this.accounts] : [];
  }

  async getFirstPage() {
    console.log("[keyring] addAccounts")
    // return new Promise((resolve, reject) => {
    console.log("[keyring] getting accounts")
    let c = new SelfConnect();
    const accounts = await c.getAccountsCloud();
    console.log("[keyring] accounts retrieved")
    console.log("[keyring] " + accounts)

    for (let i = 0; i < accounts.length; i++) {
      // TODO: format to met Metamask account requirements.
      this.accounts.push(accounts[i])
    }
  }

  signTransaction(address, tx) {
    console.log("[keyring] signTransaction called")
    return new Promise(async (resolve, reject) => {
      try {
        console.log("[keyring] signing transactions")
        const signedTx = await SelfConnect.signTxCloud(tx);
        const txData = tx.toJSON();
        txData.v = ethUtil.addHexPrefix(signedTx.v);
        txData.r = ethUtil.addHexPrefix(signedTx.r);
        txData.s = ethUtil.addHexPrefix(signedTx.s);

        const common = tx.common;
        const freeze = Object.isFrozen(tx);
        const feeMarketTransaction = FeeMarketEIP1559Transaction.fromTxData(
          txData,
          { common, freeze },
        );
        resolve(feeMarketTransaction);
      } catch (err) {
        reject(new Error(err));
      }
    });
  }
}

SelfKeyring.type = keyringType
module.exports = SelfKeyring;
