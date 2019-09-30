const sha256 = require('sha256');
const uuid = require('uuid/v1');
const currentNodeUrl = process.argv[3];

// This is used for generating the blockchain with a genesis block
function Blockchain() {
    this.chain = [];
    this.pendingTransactions = [];
    this.currentNodeUrl = currentNodeUrl;
    this.networkNodes = [];
    this.createNewBlock(1997, 'SemesterSystem', 'CompetencyBasedEducation');
};

// This is used internally during the mining process for generating a new block and adding it to the chain ('/mine')
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

// This is used internally for generating a new transaction from POST data ('/transaction/broadcast')
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

// This is used internally for adding a transaction to the pendingTransactions('/transaction/broadcast')
Blockchain.prototype.addTransactionToPendingTransactions = function(transactionObj) {
    this.pendingTransactions.push(transactionObj);
    return this.getLastBlock()['index'] + 1;
};

// This is used internally for generating a block hash during during mining and verification
Blockchain.prototype.hashBlock = function(previousBlockHash, currentBlockData, nonce) {
    const concatenatedData = previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData);
    const hash = sha256(concatenatedData);
    return hash;
};

// This is the function used to find a nonce with the first 4 characters of '0000' ('/mine')
// The difficulty can be modified by adding or removing the quantity of '0' in the function
Blockchain.prototype.proofOfWork = function(previousBlockHash, currentBlockData) {
    let nonce = 0;
    let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
    while (hash.substring(0, 4) !== '0000') {
        nonce++;
        hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
    }

    return nonce;
};

// Used to verify that all hashes on the blockchain are valid ('/consensus')
Blockchain.prototype.chainIsValid = function(blockchain) {
    let validChain = true;

    for (var i = 1; i < blockchain.length; i++) {
        const currentBlock = blockchain[i];
        const previousBlock = blockchain[i - 1];
        const blockhash = this.hashBlock(
            previousBlock['hash'], 
            { transactions: currentBlock['transactions'], index: currentBlock['index'] }, 
            currentBlock['nonce']
        );

        // Check if the blockhash is valid 
        // It must have '0000' at the beginning
        if(blockhash.substring(0, 4) !== '0000') validChain = false;
        // The previousBlockHash in the currentBlock must match the hash from the previous block
        if (currentBlock['previousBlockHash'] !== previousBlock['hash']) validChain = false;

        // console.log('previousBlockHash =>', previousBlock['hash']);
        // console.log('     ');
        // console.log('currentBlockHash => ', currentBlock['hash']);
        
    };

    const genesisBlock = blockchain[0];
    const correctNonce = genesisBlock['nonce'] === 1997;
    const correctPreviousBlockHash = genesisBlock['previousBlockHash'] === 'SemesterSystem';
    const correctHash = genesisBlock['hash'] === 'CompetencyBasedEducation';
    const correctTransactions = genesisBlock['transactions'].length === 0;

    // Verify that the genesisBlock has not been modified
    if(!correctNonce || !correctPreviousBlockHash || !correctHash || !correctTransactions) validChain = false;

    return validChain;
};

// Used to get a specific block by it's hash ('/block/:blockHash')
Blockchain.prototype.getBlock = function(blockHash) {
    let correctBlock = null;
    this.chain.forEach(block => {
        if(block.hash === blockHash) correctBlock = block;
    });

    return correctBlock;
};

// Used to get a specific transaction by it's id ('/transaction/:transactionId')
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

// Used to get balance and transactions for a specific address ('/address/:address')
Blockchain.prototype.getAddressData = function(address) {
    const addressTransactions = [];
    const addressBlockIndexes = [];

    // Find transactions that match the address
    this.chain.forEach(block => {
        block.transactions.forEach (transaction => {
            if (transaction.sender === address || transaction.recipient === address) {
                addressTransactions.push(transaction);
                addressBlockIndexes.push(block.index);
            };
        });
    });

    let balance = 0;

    // Calculate the balance of the address
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