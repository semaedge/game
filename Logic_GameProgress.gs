class Logic_GameProgress {
  static getLatestProgress(userId) {
    let progress = DB_Progress.getByUserId(userId);
    if (!progress) {
      progress = DB_Progress.save(userId, 0, [0]);
    }
    return progress;
  }

  static updatePlayerStage(userId, newStage) {
    const progress = Logic_GameProgress.getLatestProgress(userId);
    const stage = Number(newStage);
    if (!Number.isInteger(stage) || !Helper_Maps.getMapDefinition(stage)) {
      throw new Error('Estágio inválido.');
    }
    if (progress.unlockedStages.indexOf(stage) === -1) {
      progress.unlockedStages.push(stage);
    }
    return DB_Progress.save(userId, stage, progress.unlockedStages);
  }

  static completeStage(userId, completedStage) {
    const stage = Number(completedStage);
    const progress = Logic_GameProgress.getLatestProgress(userId);
    if (progress.unlockedStages.indexOf(stage) === -1) {
      throw new Error('Este estágio ainda não está desbloqueado.');
    }

    const nextStage = stage + 1;
    const hasNextStage = Boolean(Helper_Maps.getMapDefinition(nextStage));
    if (hasNextStage && progress.unlockedStages.indexOf(nextStage) === -1) {
      progress.unlockedStages.push(nextStage);
    }
    progress.currentStage = hasNextStage ? nextStage : stage;
    return DB_Progress.save(userId, progress.currentStage, progress.unlockedStages);
  }

  static isStageUnlocked(userId, stage) {
    const progress = Logic_GameProgress.getLatestProgress(userId);
    return progress.unlockedStages.indexOf(Number(stage)) !== -1;
  }
}
