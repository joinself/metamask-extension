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

  async serialize() {
    return {
      creds: this.creds,
      accounts: this.accounts,
      accountIndices: this.accountIndices,
      accountOpts: this.accountOpts,
      walletUID: this.walletUID,
      appName: this.appName,
      name: this.name,  // Legacy; use is deprecated
      network: this.network,
      page: this.page,
      hdPath: this.hdPath,
    };
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

  setHdPath(hdPath) {
    console.log(`[keyring] setHdPath to ${hdPath}`);
    this.hdPath = hdPath;
  }

  // This is being called when the user selects the accounts he wents to import into metamask,
  // and the parameter refers to the index of the account he wants to import.
  async addAccounts(_n = 1) {
    // FIXME: this is already been managed through Import accounts
    console.log(`[addAccounts] method has been hitted`);

    return this.accounts;
  }


  getAccounts() {
    return this.accounts ? [...this.accounts] : [];
  }

  async getFirstPage() {
    console.log('[keyring] retrieving accounts from user device');

    const c = new SelfConnect();
    const accounts = await c.getAccountsCloud();
    console.log('[keyring] accounts retrieved');
    console.log(accounts);

    this._importAccounts(accounts);

    return this._getFirstAccount();
  }

  _getFirstAccount() {
    // TODO: properly manage this
    return [{ address: this.getAccounts()[0], balance: null, index: 0 }];
  }

  async getNextPage() {
    // TODO: properly manage this
    return this._getFirstAccount();
  }

  async getPreviousPage() {
    // TODO: properly manage this
    return this._getFirstAccount();
  }

  setAccountToUnlock(index) {
    this.unlockedAccount = parseInt(index, 10);
  }

  async _importAccounts(accounts) {
    console.log('[_importAccounts] importing accounts to MetaMask');
    // TODO: how do we manage this walletUID, maybe it should be the SelfID?
    const walletUID = 'SELF'.toString('hex');

    for (let i = 0; i < accounts.length; i++) {
      const accountID = accounts[i].id;
      const addr = this._addressFromAccountID(accountID);

      if (!this._isAlreadySaved(walletUID, addr, accountID)) {
        console.log(`[keyring] adding ${addr}`);
        this.accounts.push(addr);
        this.accountIndices.push(this.unlockedAccount + i);
        this.accountOpts.push({
          walletUID,
          accountID: accountID,
          hdPath: this.hdPath,
        });
      }
      console.log(this.accounts);
      console.log(this.accountOpts);
    }
  }

  _isAlreadySaved(walletUID, addr, accountID) {
    let alreadySaved = false;

    for (let j = 0; j < this.accounts.length; j++) {
      if ((this.accounts[j] === addr) &&
          (this.accountOpts[j].walletUID === walletUID) &&
          (this.accountOpts[j].id === accountID) &&
          (this.accountOpts[j].hdPath === this.hdPath))
          console.log("[keyring] account "+addr+" already saved")
          alreadySaved = true;
    }

    return alreadySaved;
  }

  _addressFromAccountID(accountID) {
    const decoded = atob(accountID);
    return decoded.split(':')[1];
  }

  _getAccountIDForAddress(addr) {
    for (let j = 0; j < this.accounts.length; j++) {
      const a = this.accounts[j].toString('hex').toLowerCase();
      const b = addr.toString('hex').toLowerCase();
      console.log(`[_getAccountSelfID] ${a} === ${b}`);
      console.log(this.accounts[j]);
      if (a == b) {
        console.log(`[_getAccountSelfID] account ${this.accountOpts[j]} found`);
        return this.accountOpts[j].accountID;
      }
    }
    return null;
  }

  removeAccount(address) {
    this.accounts.forEach((account, i) => {
      if (account.toLowerCase() === address.toLowerCase()) {
        this.accounts.splice(i, 1);
        this.accountIndices.splice(i, 1);
        this.accountOpts.splice(i, 1);
      }
    });
  }

  // Deterimine if we have a connection to the Lattice and an existing wallet UID
  // against which to make requests.
  isUnlocked () {
    return !!this._getCurrentWalletUID() && !!this.sdkSession;
  }

  signTransaction(address, tx) {
    console.log("[keyring] signTransaction called")
    return new Promise(async (resolve, reject) => {
      try {
        console.log("[keyring] signing transactions")
        let accountID = this._getAccountIDForAddress(address);
        if (!accountID) {
          console.log("[keyring] no accountID for " + address);
          return reject(new Error("no accountID for " + address));
        }

        let c = new SelfConnect();
        const signedTx = await c.signTxCloud(tx, accountID);
        console.log(".......")
        console.log(".......")
        console.log(".......")
        console.log(signedTx)
        console.log(".......")
        console.log(".......")
        console.log(".......")
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
