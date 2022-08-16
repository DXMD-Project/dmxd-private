import "./App.css";
import * as buffer from "buffer";
import React, { useState } from "react";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import {
  Connection,
  PublicKey,
  Transaction,
  clusterApiUrl,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import AWS from 'aws-sdk';
const invokeLambda = (lambda, params) => new Promise((resolve, reject) => {
  lambda.invoke(params, (error, data) => {
    if (error) {
      reject(error);
    } else {
      resolve(data);
    }
  });
});
window.Buffer = buffer.Buffer;

const NETWORK = clusterApiUrl("devnet");
const getProvider = () => {
  if ("solana" in window) {
    const anyWindow = window;
    const provider = anyWindow.solana;
    if (provider.isPhantom) {
      return provider;
    }
  }
};

function App() {
  const [dateState, setDateState] = useState(new Date());
  const [available, setAvailable] = useState([]);
  const provider = getProvider();
  const connection = new Connection(NETWORK);
  const [wallet, setWallet] = React.useState(null);
  const [destAddy, setDestAddy] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [status, setStatus] = React.useState("");

  AWS.config.update({ 
    accessKeyId: '', 
    secretAccessKey: '', 
    region: 'us-west-1',
  });

  React.useEffect(() => {
    connectWallet();
  });

  const connectWallet = async () => {
    const { solana } = window;

    if (solana) {
      const response = await solana.connect();
      setWallet(response.publicKey);
    }
  };

  const createTransferTransaction = async () => {
    if (!provider.publicKey) return;
    console.log("did something public key", provider.publicKey);
    const dxmdWallet = new PublicKey(
      "6MY9bicoRqmuxPWGxo3sPTsuVTq3Pvj1gkzfuZg6Xv1H"
    );
    const escrowWallet = new PublicKey(
      "2shBLPKNBfnTXZ6ai4YQLMAFyMgdZGQqbDcFCTvFkaFs"
    );
    const treasuryWallet = new PublicKey(
      "5RXmpYzMiaUEqbQg7dfSJQNYm15qcQcLotuGjuNehnEG"
    );
    const testEscrowWallet = new PublicKey(
      "BTWhv48SWjmegveKmGHAN52Uj6osfGVkH1nXGMhe143q"
    );
    let transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: provider.publicKey,
        toPubkey: testEscrowWallet,
        lamports: Number(amount) * LAMPORTS_PER_SOL,
      })
    );
    transaction.feePayer = provider.publicKey;
    console.log("Getting recent blockhash");
    setStatus("Getting recent blockhash");
    const anyTransaction = transaction;
    anyTransaction.recentBlockhash = (
      await connection.getRecentBlockhash()
    ).blockhash;
    return transaction;
  };

  const sendTransaction = async () => {
    try {
      const transaction = await createTransferTransaction();
      if (!transaction) return;
      let signed = await provider.signTransaction(transaction);
      console.log("Got signature, submitting transaction");
      setStatus("Got signature, submitting transaction...")
      let signature = await connection.sendRawTransaction(signed.serialize());
      console.log(
        "Submitted transaction " + signature + ", awaiting confirmation"
      );
      setStatus("Submitted transaction " + signature + ", awaiting confirmation")
      await connection.confirmTransaction(signature);
      console.log("Transaction " + signature + " confirmed");
      setStatus("Transaction " + signature + " confirmed");
      // Now call AWS here to send the tokens to the destination addy.
      const requestOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          destinationAddress: destAddy,
        }),
      };
      const params = {
        FunctionName: 'dxmd-solana-autopay', 
        Payload: JSON.stringify({
          'amount': amount,
          'destinationAddress': destAddy
        }),
      };
      setStatus("Escrow wallet distribution happening...")
      const result = await (new AWS.Lambda().invoke(params).promise());
      console.log('Success!');
    console.log(result);
    setStatus(result?.FunctionError == "Unhandled" ? "Solana Timed Out" : "Success!")
    //   fetch(
    //     "https://kbsyjjwn2m.execute-api.us-west-1.amazonaws.com/default/dxmd-solana-autopay",
    //     // "https://jpendif8c1.execute-api.us-west-1.amazonaws.com/default/dxmd-solana-autopay",
    //     requestOptions
    //   )
    //     .then((response) => console.log(response.json()))
    //     .then((data) => setStatus("Complete!"));
    //   return true;
    } catch (err) {
      console.warn(err);
      console.log("[error] sendTransaction: " + JSON.stringify(err));
      setStatus("Error in sending transaction.")
    }

    
  
    
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>DXMD Private</h1>
        <img src="https://www.dxmd.co/static/media/DXMDLogo.4e4e98a8.svg" width="100" height="100"/>
        <br />
        <br />
        Amount you want to send:
        <TextField
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          id="outlined-basic"
          // label="Send amount"
          variant="outlined"
          style={{ marginTop: 25, backgroundColor: "white", width: 500 }}
        />
        {/* {amount} */}
        <br />
        Destination Address:
        <TextField
          value={destAddy}
          onChange={(event) => setDestAddy(event.target.value)}
          id="outlined-basic"
          // label="Destination Address"
          variant="outlined"
          style={{ marginTop: 25, backgroundColor: "white", width: 500 }}
        />
        {/* {destAddy} */}
        <br />
        <Button variant="contained" onClick={() => sendTransaction()}>
          Send
        </Button>
        {status}
      </header>
    </div>
  );
}

export default App;
