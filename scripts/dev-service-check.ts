import { initDb } from '../src/infra/db.js';
import { PointsRepository } from '../src/infra/PointsRepository.js';
import { PointsService } from '../src/domain/PointsService.js';
import { getTodayRangeJstIso } from '../src/utils/jstDate.js';

async function testService() {
  try {
    console.log('🔧 Testing PointsService...');
    
    const db = await initDb();
    const repo = new PointsRepository(db);
    const service = new PointsService(repo);
    
    const guildId = 'test-guild';
    const giverUserId = 'giver-user';
    const receiverUserId = 'receiver-user';
    const typeKey = 'mero';
    
    // Test 1: 1回目のgive（成功）
    console.log('1. Testing first give (amount=50)...');
    const result1 = await service.give({
      guildId,
      typeKey,
      giverUserId,
      giverIsBot: false,
      receiverUserId,
      receiverIsBot: false,
      amount: 50,
      message: '最初の付与です',
    });
    console.log(`✅ First give result: newBalance=${result1.newBalance}, txId=${result1.txId}`);
    
    // Test 2: 2回目のgive（成功）
    console.log('2. Testing second give (amount=50)...');
    const result2 = await service.give({
      guildId,
      typeKey,
      giverUserId,
      giverIsBot: false,
      receiverUserId,
      receiverIsBot: false,
      amount: 50,
      message: '二回目の付与です',
    });
    console.log(`✅ Second give result: newBalance=${result2.newBalance}, txId=${result2.txId}`);
    
    // Test 3: 残高確認
    console.log('3. Testing final balance...');
    const finalBalance = await repo.getBalance(guildId, receiverUserId, typeKey);
    console.log(`✅ Final balance: ${finalBalance}`);
    
    // Test 4: JST日次送信回数確認
    console.log('4. Testing daily transaction count...');
    const range = getTodayRangeJstIso();
    const todayCount = await repo.countGiverTransactionsInRange(
      guildId,
      typeKey,
      giverUserId,
      range.fromIso,
      range.toIso
    );
    console.log(`✅ Today's transaction count: ${todayCount}`);
    console.log(`   Range: ${range.fromIso} ~ ${range.toIso}`);
    
    // Test 5: バリデーションエラー確認
    console.log('5. Testing validation errors...');
    try {
      await service.give({
        guildId,
        typeKey,
        giverUserId,
        giverIsBot: false,
        receiverUserId,
        receiverIsBot: false,
        amount: 0, // 範囲外
        message: 'テスト',
      });
    } catch (error: any) {
      console.log(`✅ Validation error caught: ${error.name} - ${error.message}`);
    }
    
    // Test 6: 自己送信エラー確認
    console.log('6. Testing self-send error...');
    try {
      await service.give({
        guildId,
        typeKey,
        giverUserId,
        giverIsBot: false,
        receiverUserId: giverUserId, // 自己送信
        receiverIsBot: false,
        amount: 10,
        message: 'テスト',
      });
    } catch (error: any) {
      console.log(`✅ Self-send error caught: ${error.name} - ${error.message}`);
    }
    
    await db.close();
    console.log('✅ All tests completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testService();
