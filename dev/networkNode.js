// TODO - Build a wallet
// TODO - Ongoing mining function
// TODO - Dynamically set difficulty based on hash power (proofOfWork)
// TODO - More complex consensus algorithm
// TODO - Pass in an array of for new node creation
// TODO - Automatically register node download blockchain upon node creation
// TODO - Create a function to consolidate broadcasts to nodes and replace duplicate forEach loops
// TODO - Verify that an address has the correct amount before accepting a transaction into pending

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const uuid = require('uuid/v1');
const port = process.argv[2];
const rp = require('request-promise');
const Blockchain = require('./blockchain');

const nodeAddress = uuid().split('-').join('');
const wgucoin = new Blockchain();

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

//This is the endpoint used to view the current state of the blockchain (Browser)
app.get('/blockchain', function (req, res) {
    res.send(wgucoin);
});

//This endpoint is used internally to register a transaction with this node
app.post('/transaction', function (req, res) {
   const newTransaction = req.body;
   const blockIndex = wgucoin.addTransactionToPendingTransactions(newTransaction);
   res.json({ note: `Transaction will be added in block ${blockIndex}`});
});

//This endpoint is used to mine a new block and broadcast the changes to the blockchain (Browser)
app.get('/mine', function (req, res) {
    const lastBlock = wgucoin.getLastBlock();
    const previousBlockHash = lastBlock['hash'];
    const currentBlockData = { 
        transactions: wgucoin.pendingTransactions,
        index: lastBlock['index'] + 1
    }
    const nonce = wgucoin.proofOfWork(previousBlockHash, currentBlockData);
    const blockHash = wgucoin.hashBlock(previousBlockHash, currentBlockData, nonce);
    const newBlock = wgucoin.createNewBlock(nonce, previousBlockHash, blockHash);

    const requestPromises = [];
    wgucoin.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/receive-new-block',
            method: 'POST',
            body: { newBlock: newBlock },
            json: true
        };

        requestPromises.push(rp(requestOptions));
    });

    Promise.all(requestPromises).then(data => {
        const requestOptions = {
            uri: wgucoin.currentNodeUrl + '/transaction/broadcast',
            method: 'POST',
            body: {
                amount: 12.5,
                sender: 00,
                recipient: nodeAddress
            },
            json: true
        };

        return rp(requestOptions);
    }).then(data => {
        res.json({
            note: "New block mined & broadcast successfully",
            block: newBlock
        });
    });
});

//Used internally for adding a block and removing pendingTransactions when another node mines a block.
app.post('/receive-new-block', function (req, res) {
    const newBlock = req.body.newBlock;
    const lastBlock = wgucoin.getLastBlock();
    const correctHash = lastBlock.hash === newBlock.previousBlockHash;
    const correctIndex = lastBlock['index'] +1 === newBlock['index'];

    if(correctHash && correctIndex) {
        wgucoin.chain.push(newBlock);
        wgucoin.pendingTransactions = [];

        res.json({ 
            note: 'New block received and accepted.',
            newBlock: newBlock
        });
    } else {
        res.json({
            note: 'New block rejected',
            newBlock: newBlock
        })
    };  
});

//This is the endpoint used to register a node with the network (Postman)
app.post('/register-and-broadcast-node', function(req, res) {
    const newNodeUrl = req.body.newNodeUrl;
    if (wgucoin.networkNodes.indexOf(newNodeUrl) == -1) wgucoin.networkNodes.push(newNodeUrl);

    const regNodesPromises = [];
    wgucoin.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/register-node',
            method: 'POST',
            body: { newNodeUrl: newNodeUrl },
            json: true
        };
        regNodesPromises.push(rp(requestOptions));
    });
    Promise.all(regNodesPromises).then(data => {
        const bulkRegisterOptions = {
            uri: newNodeUrl + '/register-nodes-bulk',
            method: 'POST',
            body: { allNetworkNodes: [ ...wgucoin.networkNodes, wgucoin.currentNodeUrl]},
            json: true
        };

        return rp(bulkRegisterOptions);
    }).then(data => {
       res.json({note: 'New node registered with network sucessfully.'}); 
    });
});

//This endpoint is used internally to add a node to the nodes list of network nodes.
app.post('/register-node', function(req, res) {
    const newNodeUrl = req.body.newNodeUrl;
    const nodeNotAlreadyPresent = wgucoin.networkNodes.indexOf(newNodeUrl) == -1;
    const notCurrentNode = wgucoin.currentNodeUrl !== newNodeUrl;
    if (nodeNotAlreadyPresent && notCurrentNode) wgucoin.networkNodes.push(newNodeUrl);
    res.json({note: 'New node registered successfully.'});
});

//This endpoint is used internally for bulk registering all the nodes on the network.
app.post('/register-nodes-bulk', function(req, res) {
    const allNetworkNodes = req.body.allNetworkNodes;
    allNetworkNodes.forEach(networkNodeUrl => {
        const nodeNotAlreadyPresent = wgucoin.networkNodes.indexOf(networkNodeUrl) == -1;
        const notCurrentNode = wgucoin.currentNodeUrl !== networkNodeUrl;
        if(nodeNotAlreadyPresent && notCurrentNode) wgucoin.networkNodes.push(networkNodeUrl);
    });
    res.json({ note: 'Bulk registration successful.'});
});

//This is the endpoint used for submitting a transaction to the network (Postman)
app.post('/transaction/broadcast', function(req, res) {
    const newTransaction = wgucoin.createNewTransaction(req.body.amount, req.body.sender, req.body.recipient);
    wgucoin.addTransactionToPendingTransactions(newTransaction);
    const requestPromises = [];
    wgucoin.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/transaction',
            method: 'POST',
            body: newTransaction,
            json: true
        }

        requestPromises.push(rp(requestOptions));
    });

    Promise.all(requestPromises).then( data => {
        res.json({note: 'Transaction created and broadcast successfully'});
    })
});

//Used to find consensus among nodes for which blockchain is valid based on longest chain
app.get('/consensus', function(req, res) {
    const requestPromises = [];
    wgucoin.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/blockchain',
            method: 'GET',
            json: true
        }

        requestPromises.push(rp(requestOptions));
    })

    Promise.all(requestPromises).then(blockchains => {
        const currentChainLength = wgucoin.chain.length;
        let maxChainLength = currentChainLength;
        let newLongestChain = null;
        let newPendingTransactions = null;

        blockchains.forEach(blockchain => {
            if (blockchain.chain.length > maxChainLength) {
                maxChainLength = blockchain.chain.length;
                newLongestChain = blockchain.chain;
                newPendingTransactions = blockchain.pendingTransactions;
            };
        });

        if (!newLongestChain || (newLongestChain && !wgucoin.chainIsValid(newLongestChain))) {
            res.json({
                note: 'Current chain has not been replaced.',
                chain: wgucoin.chain
            });
        }
        else if (newLongestChain && wgucoin.chainIsValid(newLongestChain)) {
            wgucoin.chain = newLongestChain;
            wgucoin.pendingTransactions = newPendingTransactions;
            res.json({
                note: 'This chain has been replaced',
                chain: wgucoin.chain
            });
        };
    });
});

app.get('/block/:blockHash', function(req, res) {
    const blockHash = req.params.blockHash;
    const correctBlock = wgucoin.getBlock(blockHash);
    res.json({
        block: correctBlock
    })
});

app.get('/transaction/:transactionId', function(req, res) {
    const transactionId = req.params.transactionId;
    const transactionData = wgucoin.getTransaction(transactionId);
    res.json({
        transaction: transactionData.transaction,
        block: transactionData.block
    })
});

app.get('/address/:address', function(req, res) {
    const address = req.params.address;
    const addressData = wgucoin.getAddressData(address);
    res.json({
        addressData: addressData
    });
});

app.get('/block-explorer', function(req, res) {
    res.sendFile('./block-explorer/index.html', { root: __dirname });
});

app.listen(port, function() {
    console.log(`Listening on port ${port}...`);
});
