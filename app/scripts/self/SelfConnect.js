export default class SelfConnect {
  appUrl = 'http://localhost:8080';

  constructor() {
    console.log("[self-connect] constructing")
  }

  async getAccountsCloud() {
    console.log("[self-connect] get accounts")
    let newAccounts = [];

    //create a listener for the imported accounts
    window.addEventListener(
      'message',
      (event) => {
        if (event.data.event_id === 'imported_accounts') {
          newAccounts = event.data.accounts;
        }
      },
      false,
    );

    return new Promise(async (resolve) => {
      const child = window.open(this.appUrl + '/v1/accounts');
      const interval = setInterval(() => {
        if (child.closed) {
          //when the popup is closed
          clearInterval(interval);
          this.accounts = newAccounts;
          resolve(newAccounts);
        }
      }, 1000);
    });
  }

  async signTxCloud(transaction) {
    console.log("[self-connect] sign transaction")
    let signedTx = {};

    //create a listener for the signedTx
    window.addEventListener(
      'message',
      (event) => {
        if (event.data.event_id === 'signedTx') {
          signedTx = {
            v: event.data.v,
            r: event.data.r,
            s: event.data.s,
          };
        }
      },
      false,
    );

    return new Promise(async (resolve) => {
      const child = window.open(this.appUrl + '/v1/accounts/1/sign'); //open popup

      child.postMessage(
        //sends message to the popup
        {
          event_id: 'unsignedTx',
          data: {
            tx: transaction.serialize().toString('hex'),
          },
        },
        '*',
      );

      const interval = setInterval(() => {
        if (child.closed) {
          //when the popup is closed
          clearInterval(interval);
          resolve(signedTx);
        }
      }, 1000);
    });
  }
}
