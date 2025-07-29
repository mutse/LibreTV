import { getDatabase, executeQuery, executeUpdate, initTables } from './lib/database.js';

async function checkAndInitDatabase() {
  try {
    console.log('开始检查数据库状态...');
    
    // 1. 初始化表结构
    console.log('初始化表结构...');
    await initTables();
    
    // 2. 检查订阅计划
    console.log('检查订阅计划数据...');
    const plans = await executeQuery('SELECT * FROM subscription_plans WHERE is_active = 1');
    console.log('现有订阅计划:', plans);
    
    if (!plans.results || plans.results.length === 0) {
      console.log('没有订阅计划，开始插入默认数据...');
      
      // 插入默认订阅计划
      await executeUpdate(
        `INSERT INTO subscription_plans (name, description, duration_months, price, is_active) VALUES 
         ('月度订阅', '享受全部视频内容，月度订阅', 1, 9.9, 1),
         ('年度订阅', '享受全部视频内容，年度订阅更优惠', 12, 99.9, 1)`
      );
      
      console.log('默认订阅计划插入完成');
      
      // 再次检查
      const newPlans = await executeQuery('SELECT * FROM subscription_plans WHERE is_active = 1');
      console.log('插入后的订阅计划:', newPlans);
    } else {
      console.log('订阅计划数据正常，共', plans.results.length, '个计划');
    }
    
    // 3. 检查用户表
    console.log('检查用户表...');
    const userCount = await executeQuery('SELECT COUNT(*) as count FROM users');
    console.log('用户数量:', userCount.results?.[0]?.count || 0);
    
    // 4. 检查订阅表
    console.log('检查订阅表...');
    const subscriptionCount = await executeQuery('SELECT COUNT(*) as count FROM user_subscriptions');
    console.log('订阅数量:', subscriptionCount.results?.[0]?.count || 0);
    
    console.log('数据库检查完成');
    
  } catch (error) {
    console.error('数据库检查失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (process.argv[1].endsWith('check-database.js')) {
  checkAndInitDatabase()
    .then(() => {
      console.log('数据库检查成功完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('数据库检查失败:', error);
      process.exit(1);
    });
}

export { checkAndInitDatabase };