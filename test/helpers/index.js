// const { BN } = require('@openzeppelin/test-helpers');
// const setup = require('./setup');
// const BalancerProxy = artifacts.require('BalancerProxy');
// const BalancerPool = artifacts.require('IConfigurableRightsPool');
// const FarmFactory = artifacts.require('FarmFactory');
// const SeedFactory = artifacts.require('SeedFactory');
// const IERC20 = artifacts.require('IERC20');


// const AMOUNT = new BN('1000');
// const EXPECTED = new BN('500');
// const RETURNED = new BN('996');
// const RETURNED2 = new BN('997');

// const encodeSetPublicSwap = (publicSwap) => {
//   return new web3.eth.Contract(BalancerPool.abi).methods.setPublicSwap(publicSwap).encodeABI();
// };
// const encodeSetSwapFee = (swapFee) => {
//   return new web3.eth.Contract(BalancerPool.abi).methods.setSwapFee(swapFee).encodeABI();
// };
// const encodeCommitAddToken = (token, balance, denormalizedWeight) => {
//   return new web3.eth.Contract(BalancerPool.abi).methods.commitAddToken(token, balance, denormalizedWeight).encodeABI();
// };
// const encodeApplyAddToken = () => {
//   return new web3.eth.Contract(BalancerPool.abi).methods.applyAddToken().encodeABI();
// };
// const encodeRemoveToken = (token) => {
//   return new web3.eth.Contract(BalancerPool.abi).methods.removeToken(token).encodeABI();
// };
// const encodeUpdateWeightsGradually = (newWeights, startBlock, endBlock) => {
//   return new web3.eth.Contract(BalancerPool.abi).methods.updateWeightsGradually(newWeights, startBlock, endBlock).encodeABI();
// };
// const encodeJoinPool = (poolAmountOut, maxAmountsIn) => {
//   return new web3.eth.Contract(BalancerPool.abi).methods.joinPool(poolAmountOut, maxAmountsIn).encodeABI();
// };
// const encodeExitPool = (poolAmountIn, minAmountsOut) => {
//   return new web3.eth.Contract(BalancerPool.abi).methods.exitPool(poolAmountIn, minAmountsOut).encodeABI();
// };
// const encodeUpdateWeight = (token, newWeight) => {
//   return new web3.eth.Contract(BalancerPool.abi).methods.updateWeight(token, newWeight).encodeABI();
// };
// const encodeCreateFarm = (name, rewardToken, stakingToken, initreward, starttime, duration) => {
//   return new web3.eth.Contract(FarmFactory.abi).methods.createFarm(name, rewardToken, stakingToken, initreward, starttime, duration).encodeABI();
// };
// const encodeRescueTokens = (stakingRewards, amount, token, to) => {
//   return new web3.eth.Contract(FarmFactory.abi).methods.rescueTokens(stakingRewards, amount, token, to).encodeABI();
// };
// const encodeIncreaseReward = (farm, amount) => {
//   return new web3.eth.Contract(FarmFactory.abi).methods.increaseReward(farm, amount).encodeABI();
// };
// const encodeChangeMasterCopyFarm = (newParent) => {
//   return new web3.eth.Contract(FarmFactory.abi).methods.changeMasterCopy(newParent).encodeABI();
// };
// const encodeApprove = (spender, amount) => {
//   return new web3.eth.Contract(IERC20.abi).methods.approve(spender, amount).encodeABI();
// };
// const encodeDeploySeed = (dao, admin, tokens, softAndHardCap, price, startTime, endTime, vestingDuration, vestingCliff, isWhitelisted, fee, metadata) => {
//   return new web3.eth.Contract(SeedFactory.abi).methods.deploySeed(dao, admin, tokens, softAndHardCap, price, startTime, endTime, vestingDuration, vestingCliff, isWhitelisted, fee, metadata).encodeABI();
// };
// const encodeSetMasterCopy = (newParent) => {
//   return new web3.eth.Contract(SeedFactory.abi).methods.setMasterCopy(newParent).encodeABI();
// };
// const encodeTransferOwnership = (newOwner) => {
//   return new web3.eth.Contract(SeedFactory.abi).methods.transferOwnership(newOwner).encodeABI();
// };

// const getValueFromLogs = (tx, arg, eventName, index = 0) => {
//   /**
//    *
//    * tx.logs look like this:
//    *
//    * [ { logIndex: 13,
//    *     transactionIndex: 0,
//    *     transactionHash: '0x999e51b4124371412924d73b60a0ae1008462eb367db45f8452b134e5a8d56c8',
//    *     blockHash: '0xe35f7c374475a6933a500f48d4dfe5dce5b3072ad316f64fbf830728c6fe6fc9',
//    *     blockNumber: 294,
//    *     address: '0xd6a2a42b97ba20ee8655a80a842c2a723d7d488d',
//    *     type: 'mined',
//    *     event: 'NewOrg',
//    *     args: { _avatar: '0xcc05f0cde8c3e4b6c41c9b963031829496107bbb' } } ]
//    */
//   if (!tx.logs || !tx.logs.length) {
//     throw new Error('getValueFromLogs: Transaction has no logs');
//   }

//   if (eventName !== undefined) {
//     for (let i = 0; i < tx.logs.length; i++) {
//       if (tx.logs[i].event === eventName) {
//         index = i;
//         break;
//       }
//     }
//     if (index === undefined) {
//       let msg = `getValueFromLogs: There is no event logged with eventName ${eventName}`;
//       throw new Error(msg);
//     }
//   } else {
//     if (index === undefined) {
//       index = tx.logs.length - 1;
//     }
//   }
//   let result = tx.logs[index].args[arg];
//   if (!result) {
//     let msg = `getValueFromLogs: This log does not seem to have a field "${arg}": ${tx.logs[index].args}`;
//     throw new Error(msg);
//   }
//   return result;
// };

// const getNewProposalId = (tx) => {
//   return getValueFromLogs(tx, '_proposalId', 'NewProposal');
// };

// module.exports = {
//   setup,
//   encodeSetPublicSwap,
//   encodeSetSwapFee,
//   encodeCommitAddToken,
//   encodeApplyAddToken,
//   encodeRemoveToken,
//   encodeUpdateWeightsGradually,
//   encodeUpdateWeight,
//   encodeCreateFarm,
//   encodeRescueTokens,
//   encodeIncreaseReward,
//   encodeChangeMasterCopyFarm,
//   encodeJoinPool,
//   encodeExitPool,
//   getNewProposalId,
//   encodeApprove,
//   encodeDeploySeed,
//   encodeSetMasterCopy,
//   encodeTransferOwnership,
//   values: {
//     AMOUNT,
//     EXPECTED,
//     RETURNED,
//     RETURNED2,
//   },
// };
