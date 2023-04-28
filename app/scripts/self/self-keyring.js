import SelfConnect from './SelfConnect';

const EventEmitter = require('events').EventEmitter;
const keyringType = "self"
const EthTx = require('@ethereumjs/tx');
const { addHexPrefix } = require("@ethereumjs/util");
const SDK = require('gridplus-sdk');
import { TransactionFactory, TxData, TypedTransaction } from '@ethereumjs/tx';
const { FeeMarketEIP1559Transaction } = require( '@ethereumjs/tx' );
import * as ethUtil from 'ethereumjs-util';

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
      console.log(accounts[i]);
      const accountID = accounts[i].id;
      const addr = accounts[i].address;

      if (!this._isAlreadySaved(walletUID, addr, accountID)) {
        console.log(`[keyring] adding ${addr}`);
        this.accounts.push(addr);
        this.accountIndices.push(this.unlockedAccount + i);
        this.accountOpts.push({
          walletUID,
          accountID: accountID,
          selfID: accounts[i].self_id,
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

  _getAccountIDForAddress(addr) {
    for (let j = 0; j < this.accounts.length; j++) {
      const a = this.accounts[j].toString('hex').toLowerCase();
      const b = addr.toString('hex').toLowerCase();
      console.log(`[_getAccountSelfID] ${a} === ${b}`);
      console.log(this.accounts[j]);
      if (a == b) {
        console.log(`[_getAccountSelfID] account ${this.accountOpts[j].accountID} found`);
        console.log(this.accountOpts[j])
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
  isUnlocked() {
    return !!this._getCurrentWalletUID() && !!this.sdkSession;
  }

  _getCurrentWalletUID() {
    return 'self';
  }

  async signTransaction(address, tx) {
    return new Promise(async (resolve, reject) => {
      console.log('[keyring] signTransaction called');
      // We will be adding a signature to hydration data for a new
      // transaction object since the sig data is not mutable.
      // Setup `txToReturn` data and start adding to it.

      try {
        console.log('[keyring] signing transactions');
        const txToReturn = tx.toJSON();
        // txToReturn.type = tx._type || null;
        txToReturn.type = null;

        // Find the accountID for the address
        const accountID = this._getAccountIDForAddress(address);
        if (!accountID) {
          console.log(`[keyring] no accountID for ${address}`);
          return new Error(`no accountID for ${address}`);
        }

        // çççççççççççççççççççççççç
        const messageToSign = tx.getMessageToSign(false);

        const rawTxHex = Buffer.isBuffer(messageToSign)
          ? messageToSign.toString('hex')
          : ethUtil.rlp.encode(messageToSign).toString('hex');
        console.log(rawTxHex);

        // çççççççççççççççççççççççç

        // Send the transaction to Self to be signed
        const c = new SelfConnect();
        // const serializedTX = tx.serialize().toString('hex');
        const signedTx = await c.signTxCloud(accountID, rawTxHex);

        // Because tx will be immutable, first get a plain javascript object that
        // represents the transaction. Using txData here as it aligns with the
        // nomenclature of ethereumjs/tx.
        const txData = tx.toJSON();
        // The fromTxData utility expects a type to support transactions with a type other than 0
        // txData.type = tx.type;
        txData.type = null;
        // The fromTxData utility expects v,r and s to be hex prefixed
        txData.v = ethUtil.addHexPrefix(signedTx.sig.v);
        txData.r = ethUtil.addHexPrefix(signedTx.sig.r);
        txData.s = ethUtil.addHexPrefix(signedTx.sig.s);
        // Adopt the 'common' option from the original transaction and set the
        // returned object to be frozen if the original is frozen.
        resolve(TransactionFactory.fromTxData(txData, {
          common: tx.common,
          freeze: Object.isFrozen(tx),
        }));


        /*
        // Pack the signature into the return object
        txToReturn.r = addHexPrefix(signedTx.sig.r.toString('hex'));
        txToReturn.s = addHexPrefix(signedTx.sig.s.toString('hex'));
        // Legacy signatures have `v` in the response
        let v = '0';
        if (signedTx.sig.v === undefined) {
          v = SDK.Utils.getV(tx, signedTx);
        } else {
          v = signedTx.sig.v.length === 0 ? '0' : signedTx.sig.v.toString('hex');
        }

        txToReturn.v = addHexPrefix(v);
        console.log("txToReturn.v : ")
        console.log(txToReturn.v);

        console.log('END:1');


        // Adopt the 'common' option from the original transaction and set the
        // returned object to be frozen if the original is frozen.
        console.log("llllllllll")
        console.log(txToReturn);
        console.log("llllllllll")
        const finalTx = TransactionFactory.fromTxData(txToReturn, {
          common: tx.common,
          freeze: Object.isFrozen(tx),
        });

        resolve(finalTx);
*/
        /*
        const ethTx = EthTx.TransactionFactory.fromTxData(txToReturn, {
          common: tx.common,
          freeze: Object.isFrozen(tx),
        });

        const feeMarketTransaction = FeeMarketEIP1559Transaction.fromTxData(txToReturn, {
            common: tx.common,
            freeze: Object.isFrozen(tx),
        });
        console.log('...............');
        console.log('...............');
        console.log('...............');
        console.log('...............');
        console.log(tx);
        console.log(txToReturn);
        console.log(feeMarketTransaction);
        console.log('...............');
        console.log('...............');
        console.log('...............');
        console.log('...............');

        resolve(feeMarketTransaction);
        */

  /*
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
      */
      } catch (err) {
        reject(new Error(err));
      }
    });
  }
}

SelfKeyring.type = keyringType
module.exports = SelfKeyring;
