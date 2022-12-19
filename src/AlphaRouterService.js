const {
  Token,
  Fetcher,
  Route,
  Trade,
  TokenAmount,
  TradeType,
  Percent,
} = require("@uniswap/sdk");
const UNISWAP = require("@uniswap/sdk");
const ERC20ABI = require("./abi.json");
const { ethers } = require("ethers");
const JSBI = require("jsbi");

const REACT_APP_INFURA_URL_TESTNET = process.env.REACT_APP_INFURA_URL_TESTNET;

const web3Provider = new ethers.providers.JsonRpcProvider(
  REACT_APP_INFURA_URL_TESTNET
);

const UNISWAP_ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const UNISWAP_ROUTER_ABI = require("./router.json");
const UNISWAP_ROUTER_CONTRACT = new ethers.Contract(
  UNISWAP_ROUTER_ADDRESS,
  UNISWAP_ROUTER_ABI,
  web3Provider
);

export const WETH = new Token(
  UNISWAP.ChainId.GÖRLI,
  "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
  18
);

export const UNI = new Token(
  UNISWAP.ChainId.GÖRLI,
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
  18
);

export const getWethContract = () =>
  new ethers.Contract(
    "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
    ERC20ABI,
    web3Provider
  );
export const getUniContract = () =>
  new ethers.Contract(
    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
    ERC20ABI,
    web3Provider
  );

export const getPrice = async (inputAmount, token1, token2) => {
  const pair = await Fetcher.fetchPairData(token1, token2, web3Provider); //creating instances of a pair
  const sellRoute = new Route([pair], token1);
  const sellTrade = Trade.exactOut(
    sellRoute,
    new TokenAmount(token2, JSBI.BigInt(1e18))
  );
  const ratio = sellTrade.executionPrice.toSignificant(6);
  const quoteAmountOut = inputAmount * ratio;

  return [quoteAmountOut.toFixed(3), ratio];
  // return [5, 0.05];
};

export const runSwap = async (signer) => {
  swapTokens(WETH, UNI, signer, 0.02);
};

async function swapTokens(token1, token2, amount, signer, slippage = "50") {
  try {
    const pair = await Fetcher.fetchPairData(token1, token2, web3Provider); //creating instances of a pair
    const route = await new Route([pair], token2); // a fully specified path from input token to output token
    let amountIn = ethers.utils.parseEther(amount.toString()); //helper function to convert ETH to Wei
    amountIn = amountIn.toString();

    const slippageTolerance = new Percent(slippage, "10000"); // 50 bips, or 0.50% - Slippage tolerance

    const trade = new Trade( //information necessary to create a swap transaction.
      route,
      new TokenAmount(token2, amountIn),
      TradeType.EXACT_INPUT
    );

    const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw; // needs to be converted to e.g. hex
    const amountOutMinHex = ethers.BigNumber.from(
      amountOutMin.toString()
    ).toHexString();
    const path = [token2.address, token1.address]; //An array of token addresses
    const to = signer.address; // should be a checksummed recipient address
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from the current Unix time
    const value = trade.inputAmount.raw; // // needs to be converted to e.g. hex
    const valueHex = await ethers.BigNumber.from(
      value.toString()
    ).toHexString(); //convert to hex string

    //Return a copy of transactionRequest, The default implementation calls checkTransaction and resolves to if it is an ENS name, adds gasPrice, nonce, gasLimit and chainId based on the related operations on Signer.
    const rawTxn =
      await UNISWAP_ROUTER_CONTRACT.populateTransaction.swapExactETHForTokens(
        amountOutMinHex,
        path,
        to,
        deadline,
        {
          value: valueHex,
        }
      );

    //Returns a Promise which resolves to the transaction.
    let sendTxn = signer.sendTransaction(rawTxn);

    //Resolves to the TransactionReceipt once the transaction has been included in the chain for x confirms blocks.
    let reciept = (await sendTxn).wait();

    //Logs the information about the transaction it has been mined.
    // if (reciept) {
    //   console.log(
    //     " - Transaction is mined - " + "\n" + "Transaction Hash:",
    //     (await sendTxn).hash +
    //       "\n" +
    //       "Block Number: " +
    //       (await reciept).blockNumber +
    //       "\n" +
    //       "Navigate to https://goerli.etherscan.io/txn/" +
    //       (await sendTxn).hash,
    //     "to see your transaction"
    //   );
    // } else {
    //   console.log("Error submitting transaction");
    // }
  } catch (e) {
    console.log(e);
  }
}

//first argument = token we want, second = token we have, the amount we want
//swapTokens(WETH, UNI, 0.02);
