class DB_Achievements {
  static getByUserId(userId) {
    const data = DB_Core.getAllData(ACHIEVEMENTS_SHEET_NAME);
    const achievements = [];
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(userId)) {
        achievements.push({
          userId: data[i][0],
          achievementId: data[i][1],
          label: data[i][2],
          unlockedAt: data[i][3]
        });
      }
    }
    return achievements;
  }

  static grant(userId, achievementId, label) {
    const existing = DB_Achievements.getByUserId(userId).some(function(item) {
      return item.achievementId === achievementId;
    });
    if (existing) return false;
    DB_Core.appendRow(ACHIEVEMENTS_SHEET_NAME, [
      userId,
      achievementId,
      label,
      new Date().toISOString()
    ]);
    return true;
  }
  
  static getAllAchievements_() {
    const data = DB_Core.getAllData(ACHIEVEMENTS_SHEET_NAME);
    const achievements = [];
    for (let i = 1; i < data.length; i++) {
      achievements.push({
        userId: data[i][0],
        achievementId: data[i][1],
        label: data[i][2],
        unlockedAt: data[i][3]
      });
    }
    return achievements;
  }
}
