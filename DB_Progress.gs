class DB_Progress {
  static getByUserId(userId) {
    const result = DB_Core.findRow(PROGRESS_SHEET_NAME, 0, userId);
    if (!result) return null;

    let unlockedStages = [];
    try {
      const parsed = JSON.parse(result.rowData[2] || '[]');
      unlockedStages = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      unlockedStages = [];
    }
    return {
      userId: result.rowData[0],
      currentStage: Number(result.rowData[1]) || 0,
      unlockedStages: unlockedStages.map(Number).filter(function(stage) {
        return Number.isInteger(stage) && stage >= 0;
      }),
      updatedAt: result.rowData[3],
      rowIndex: result.rowIndex
    };
  }

  static save(userId, currentStage, unlockedStages) {
    const normalizedStages = Array.from(new Set((unlockedStages || []).map(Number)))
      .filter(function(stage) { return Number.isInteger(stage) && stage >= 0; })
      .sort(function(a, b) { return a - b; });
    const row = [
      userId,
      Number(currentStage) || 0,
      JSON.stringify(normalizedStages),
      new Date().toISOString()
    ];
    const current = DB_Progress.getByUserId(userId);
    if (current) {
      DB_Core.updateRow(PROGRESS_SHEET_NAME, current.rowIndex, row);
    } else {
      DB_Core.appendRow(PROGRESS_SHEET_NAME, row);
    }
    return {
      userId: userId,
      currentStage: row[1],
      unlockedStages: normalizedStages,
      updatedAt: row[3]
    };
  }
}
