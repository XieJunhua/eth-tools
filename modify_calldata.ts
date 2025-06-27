import { ethers } from "ethers";
import contractABI from "./abi.json"; // 确保你的 abi.json 包含 multicall 和 unwrapWETH9 的定义

const txData = "0xac9650d8000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000e4472b43f3000000000000000000000000000000000000000000000575c965a1bca986b440000000000000000000000000000000000000000000000000000ee6825d09e97400000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000200000000000000000000000065a0ea85bdace5f8b83d51e598443d4c01be4444000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004449404b7c000000000000000000000000000000000000000000000000000ee6825d09e97400000000000000000000000054248f4ff09d9941244e2ad103d93e7e334e394e00000000000000000000000000000000000000000000000000000000"; // 买入正常上链

async function decodeAndModifyTransactionData(abi: any[], data: string): Promise<string> {
    const iface = new ethers.Interface(abi);
    let newCalldata = data; // 默认返回原始calldata

    try {
        const parsedTx = iface.parseTransaction({ data: data });

        if (parsedTx && parsedTx.name === "multicall") {
            console.log("--- Decoding multicall transaction ---");
            console.log("Function Name:", parsedTx.name);

            let hasModified = false;
            const modifiedInternalCalls: ethers.BytesLike[] = [];

            // parsedTx.args[0] 是 multicall 的 bytes[] 参数
            const internalCalls = parsedTx.args[0] as ethers.BytesLike[];

            console.log("internalCalls", internalCalls);

            for (let i = 0; i < internalCalls.length; i++) {
                const internalCallData = internalCalls[i];
                let modifiedInternalCallData = internalCallData;

                try {
                    const internalParsed = iface.parseTransaction({ data: internalCallData });

                    if (internalParsed && internalParsed.name === "unwrapWETH9") {
                        console.log(`\n--- Found unwrapWETH9 call at index ${i} ---`);
                        console.log("  Original Function Name:", internalParsed.name);
                        console.log("  Original Parameters:", internalParsed.args.map(a => typeof a === 'object' && a.toString ? a.toString() : a));

                        // 假设 unwrapWETH9 的第一个参数是 amount (uint256)
                        const originalAmount = internalParsed.args[0] as ethers.BigNumberish;
                        console.log("originalAmount", originalAmount);
                        console.log("originalAmount._isBigNumber", typeof originalAmount);
                        if (originalAmount && typeof originalAmount === 'bigint') {
                            // 计算 99%
                            const newAmount = (originalAmount * 99n) / 100n;
                            console.log("newAmount", newAmount);

                            // 创建新的参数数组
                            const newArgs = [...internalParsed.args];
                            newArgs[0] = newAmount;

                            // 重新编码 unwrapWETH9 函数
                            modifiedInternalCallData = iface.encodeFunctionData(
                                internalParsed.fragment,
                                newArgs
                            );
                            hasModified = true;
                            console.log("  Modified amount to 99%:", newAmount.toString());
                            console.log("  New internal calldata:", modifiedInternalCallData);
                        } else {
                            console.warn("  unwrapWETH9's first argument is not a BigNumber or undefined.");
                        }
                    } else {
                        // console.log(`  Internal call at index ${i}: ${internalParsed ? internalParsed.name : 'Unknown'}`);
                    }
                } catch (e) {
                    console.warn(`  Could not parse internal call at index ${i}: ${e.message}. Keeping as is.`);
                    // 如果内部解析失败，就保留原始数据
                }
                modifiedInternalCalls.push(modifiedInternalCallData);
            }

            if (hasModified) {
                // 重新编码整个 multicall 函数
                newCalldata = iface.encodeFunctionData(
                    parsedTx.fragment,
                    [modifiedInternalCalls] // multicall 的唯一参数是 bytes[] 数组
                );
                console.log("\n--- Full multicall calldata re-encoded ---");
                console.log("New full calldata:", newCalldata);
            } else {
                console.log("\n--- No unwrapWETH9 call found or modified ---");
            }
        } else {
            console.log("Not a multicall transaction or could not parse main transaction.");
        }
    } catch (error) {
        console.error("Error decoding or modifying transaction data:", error);
        console.log("This often happens if the ABI does not match the 'data' field,");
        console.log("or if the 'data' field is not a function call (e.g., just a value transfer).");
        console.log("Raw data was:", data);
    }

    return newCalldata;
}

// 调用函数进行解码和修改
decodeAndModifyTransactionData(contractABI, txData)
    .then(newTxData => {
        console.log("\n--- Final Result ---");
        console.log("Original calldata:", txData);
        console.log("Modified calldata:", newTxData);
    })
    .catch(console.error);