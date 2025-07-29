import { executeQuery, executeUpdate, initTables } from './lib/database.js';

async function ensureSubscriptionPlans() {
  try {
    console.log('开始确保订阅计划数据...');
    
    // 检查现有计划
    const existingPlans = await executeQuery('SELECT * FROM subscription_plans');
    console.log('现有订阅计划:', existingPlans);
    
    if (!existingPlans.results || existingPlans.results.length === 0) {
      console.log('没有订阅计划，插入默认数据...');
      
      // 插入月度计划
      const monthlyResult = await executeUpdate(
        `INSERT INTO subscription_plans (name, description, duration_months, price, is_active) 
         VALUES (?, ?, ?, ?, ?)`,
        ['月度订阅', '享受全部视频内容，月度订阅', 1, 9.9, 1]
      );
      console.log('月度计划插入结果:', monthlyResult);
      
      // 插入年度计划
      const yearlyResult = await executeUpdate(
        `INSERT INTO subscription_plans (name, description, duration_months, price, is_active) 
         VALUES (?, ?, ?, ?, ?)`,
        ['年度订阅', '享受全部视频内容，年度订阅更优惠', 12, 99.9, 1]
      );
      console.log('年度计划插入结果:', yearlyResult);
    }
    
    // 再次检查
    const finalPlans = await executeQuery('SELECT * FROM subscription_plans');
    console.log('最终订阅计划:', finalPlans);
    
    // 特别检查月度计划
    const monthlyPlan = await executeQuery('SELECT * FROM subscription_plans WHERE duration_months = 1');
    console.log('月度计划检查:', monthlyPlan);
    
    if (!monthlyPlan.results || monthlyPlan.results.length === 0) {
      throw new Error('月度计划不存在，试用功能将无法工作');
    }
    
    console.log('订阅计划确保完成');
    return true;
    
  } catch (error) {
    console.error('确保订阅计划失败:', error);
    throw error;
  }
}

export { ensureSubscriptionPlans };

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  ensureSubscriptionPlans()
    .then(() => {
      console.log('订阅计划确保成功');
      process.exit(0);
    })
    .catch((error) => {
      console.error('订阅计划确保失败:', error);
      process.exit(1);
    });
}