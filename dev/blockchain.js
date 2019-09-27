const sha256 = require('sha256');
const uuid = require('uuid/v1');
const currentNodeUrl = process.argv[3];

//This is used for generating the blockchain with a genesis block
function Blockchain() {
    this.chain = [];
    this.pendingTransactions = [];
    this.currentNodeUrl = currentNodeUrl;
    this.networkNodes = [];
    this.createNewBlock(9171787, 'LifeLibertyHappiness', 'BillofRights');
};

Blockchain.prototype.createNewBlock = function(nonce, previousBlockHash, hash) {
    const newBlock = {
        index: this.chain.length + 1,
        timestamp: Date.now(),
        transactions: this.pendingTransactions,
        nonce: nonce,
        hash: hash,
        previousBlockHash: previousBlockHash
    };

    this.pendingTransactions = [];
    this.chain.push(newBlock);
    return newBlock;
};

Blockchain.prototype.getLastBlock = function() {
    return this.chain[this.chain.length -1];
};

//This is used internally for generating a new transaction from POST data
Blockchain.prototype.createNewTransaction = function(amount, sender, recipient) {
    const newTransaction = {
        transactionId: uuid().split('-').join(''),
        amount: amount,
        sender: sender,
        recipient: recipient
    }
    //   this.pendingTransactions.push(newTransaction);
    //   return this.getLastBlock()['index'] + 1;
    return newTransaction;
};

//This is used internally for adding a transaction to the pendingTransactions.
Blockchain.prototype.addTransactionToPendingTransactions = function(transactionObj) {
    this.pendingTransactions.push(transactionObj);
    return this.getLastBlock()['index'] + 1;
};

//This is used internally for generating a new block hash
Blockchain.prototype.hashBlock = function(previousBlockHash, currentBlockData, nonce) {
    const concatenatedData = previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData);
    const hash = sha256(concatenatedData);
    return hash;
};

Blockchain.prototype.proofOfWork = function(previousBlockHash, currentBlockData) {
    let nonce = 0;
    let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
    while (hash.substring(0, 4) !== '0000') {
        nonce++;
        hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
    }

    return nonce;
};

Blockchain.prototype.chainIsValid = function(blockchain) {
    let validChain = true;

    for (var i = 1; i < blockchain.length; i++) {
        const currentBlock = blockchain[i];
        const prevBlock = blockchain[i - 1];
        const blockhash = this.hashBlock(
            prevBlock['hash'], 
            { transactions: currentBlock['transactions'], index: currentBlock['index'] }, 
            currentBlock['nonce']
        );
        if(blockhash.substring(0, 4) !== '0000') validChain = false;
        if (currentBlock['previousBlockHash'] !== prevBlock['hash']) validChain = false;

        console.log('previousBlockHash =>', prevBlock['hash']);
        console.log('     ');
        console.log('currentBlockHash => ', currentBlock['hash']);
        
    };

    const genesisBlock = blockchain[0];
    const correctNonce = genesisBlock['nonce'] === 9171787;
    const correctPreviousBlockHash = genesisBlock['previousBlockHash'] === 'LifeLibertyHappiness';
    const correctHash = genesisBlock['hash'] === 'BillofRights';
    const correctTransactions = genesisBlock['transactions'].length === 0;

    if(!correctNonce || !correctPreviousBlockHash || !correctHash || !correctTransactions) validChain = false;

    return validChain;
};

Blockchain.prototype.getBlock = function(blockHash) {
    let correctBlock = null;
    this.chain.forEach(block => {
        if(block.hash === blockHash) correctBlock = block;
    });

    return correctBlock;
};

Blockchain.prototype.getTransaction = function(transactionId) {
    let correctTransaction = null;
    let correctBlock = null;
    this.chain.forEach(block => {
        block.transactions.forEach( transaction => {
            if(transaction.transactionId === transactionId) {
                correctTransaction = transaction;
                correctBlock = block;
            };
        });
    });

    return {
        transaction: correctTransaction,
        block: correctBlock
    };
};

Blockchain.prototype.getAddressData = function(address) {
    const addressTransactions = [];
    const addressBlockIndexes = [];

    this.chain.forEach(block => {
        block.transactions.forEach (transaction => {
            if (transaction.sender === address || transaction.recipient === address) {
                addressTransactions.push(transaction);
                addressBlockIndexes.push(block.index);
            };
        });
    });

    let balance = 0;
    addressTransactions.forEach(transaction => {
        if (transaction.recipient === address) balance += transaction.amount;
        else if (transaction.sender === address) balance -= transaction.amount;
    });

    return {
        addressBalance: balance,
        addressTransactions: addressTransactions,
        addressBlockIndexes: Array.from(new Set(addressBlockIndexes))
    }
};

module.exports = Blockchain;