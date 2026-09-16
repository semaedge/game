// DB_Users.gs
//
// Funcionalidade Principal: Gerencia as operações CRUD para a tabela de usuários no Google Sheet.
//
// Integrações:
// - DB_Core.gs: Utiliza as funções genéricas de CRUD da camada de banco de dados.
// - Config.gs: Obtém o nome da aba de usuários (USERS_SHEET_NAME).
//
// Uso:
// Fornece métodos para criar, ler, atualizar e deletar usuários, além de buscar usuários por nome de usuário ou email.
//
class DB_Users {
  static createUser(username, password, email) {
    const newId = Utilities.getUuid();
    const inventory = JSON.stringify({ totalPoints: 0, items: [], badges: [], hints: 3 });
    const rowData = [newId, username, password, email, new Date().toISOString(), new Date().toISOString(), inventory];
    DB_Core.appendRow(USERS_SHEET_NAME, rowData);
    Cache_Manager.remove('users:all');
    return { id: newId, username, email };
  }

  static getAllUsers() {
    const data = DB_Core.getAllData(USERS_SHEET_NAME);
    const users = [];
    // Assume a primeira linha é o cabeçalho
    for (let i = 1; i < data.length; i++) {
      users.push({
        id: data[i][0],
        username: data[i][1],
        email: data[i][3],
        createdAt: data[i][4],
        updatedAt: data[i][5],
      });
    }
    return users;
  }

  static getUserByUsername(username) {
    const result = DB_Core.findRow(USERS_SHEET_NAME, 1, username); // Coluna 1 para username
    if (result) {
      const [id, uname, pass, email, createdAt, updatedAt, inventory] = result.rowData;
      return { id, username: uname, password: pass, email, createdAt, updatedAt, inventory, rowIndex: result.rowIndex };
    }
    return null;
  }

  static getUserByEmail(email) {
    const result = DB_Core.findRow(USERS_SHEET_NAME, 3, email); // Coluna 3 para email
    if (result) {
      const [id, uname, pass, uemail, createdAt, updatedAt, inventory] = result.rowData;
      return { id, username: uname, password: pass, email: uemail, createdAt, updatedAt, inventory, rowIndex: result.rowIndex };
    }
    return null;
  }

  static updateUser(userId, newUsername, newPassword, newEmail) {
    const user = DB_Users.getUserById(userId); // Buscar pelo ID
    if (user) {
      const rowData = [user.id, newUsername, newPassword, newEmail, user.createdAt, new Date().toISOString(), user.inventory || '{}'];
      DB_Core.updateRow(USERS_SHEET_NAME, user.rowIndex, rowData);
      Cache_Manager.remove('users:all');
      return true;
    }
    return false;
  }

  static deleteUser(userId) {
    const user = DB_Users.getUserById(userId);
    if (user) {
      DB_Core.deleteRow(USERS_SHEET_NAME, user.rowIndex);
      Cache_Manager.remove('users:all');
      return true;
    }
    return false;
  }

  static getUserById(id) {
    const result = DB_Core.findRow(USERS_SHEET_NAME, 0, id); // Coluna 0 para ID
    if (result) {
      const [uid, uname, pass, email, createdAt, updatedAt, inventory] = result.rowData;
      return { id: uid, username: uname, password: pass, email, createdAt, updatedAt, inventory, rowIndex: result.rowIndex };
    }
    return null;
  }
  
  static update(userId, fields) {
    const user = DB_Users.getUserById(userId);
    if (!user) return false;
    
    const rowData = [
      user.id,
      fields.username !== undefined ? fields.username : user.username,
      fields.password !== undefined ? fields.password : user.password,
      fields.email !== undefined ? fields.email : user.email,
      user.createdAt,
      new Date().toISOString(),
      fields.inventory !== undefined ? fields.inventory : (user.inventory || '{}')
    ];
    
    DB_Core.updateRow(USERS_SHEET_NAME, user.rowIndex, rowData);
    Cache_Manager.remove('users:all');
    return true;
  }
  
  static findById(userId) {
    return DB_Users.getUserById(userId);
  }
}
