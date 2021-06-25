const send = async (trx, sender) => {
    const options = {
        safe: trx.safe,
        to: trx.to,
        value: trx.value,
        data: trx.data,
        operation: trx.operation,
        safeTxGas: trx.safeTxGas,
        baseGas: trx.baseGas,
        gasPrice: trx.gasPrice,
        nonce: trx.nonce,
        contractTransactionHash: trx.hash,
        sender,
        signature: trx.signature
      }
    //   console.log(JSON.stringify(options));
      const res = await axios.post(generateUrl(api.sendTransaction), options);
      console.log(res.status);
}

module.exports = {send}