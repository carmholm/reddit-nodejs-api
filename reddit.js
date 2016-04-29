var bcrypt = require('bcrypt');
var HASH_ROUNDS = 10;

module.exports = function RedditAPI(conn) {
  return {
    
    createUser: function(user, callback) {

      bcrypt.hash(user.password, HASH_ROUNDS, function(err, hashedPassword) {
        if (err) {
          callback(err);
        }
        else {
          conn.query(
            'INSERT INTO `users` (`username`,`password`, `createdAt`) VALUES (?, ?, ?)', [user.username, hashedPassword, null],
            function(err, result) {
              if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                  callback(new Error('A user with this username already exists'));
                }
                else {
                  callback(err);
                }
              }
              else {
                conn.query(
                  'SELECT `id`, `username`, `createdAt`, `updatedAt` FROM `users` WHERE `id` = ?', [result.insertId],
                  function(err, result) {
                    if (err) {
                      callback(err);
                    }
                    else {
                      callback(null, result[0]);
                    }
                  }
                );
              }
            }
          );
        }
      });
    },
    createPost: function(post, callback) {
      conn.query(
        'INSERT INTO `posts` (`userId`, `title`, `url`, `createdAt`) VALUES (?, ?, ?, ?)', [post.userId, post.title, post.url, null],
        function(err, result) {
          if (err) {
            callback(err);
          }
          else {
            conn.query(
              'SELECT `id`,`title`,`url`,`userId`, `createdAt`, `updatedAt` FROM `posts` WHERE `id` = ?', [result.insertId],
              function(err, result) {
                if (err) {
                  callback(err);
                }
                else {
                  callback(null, result[0]);
                }
              }
            );
          }
        }
      );
    },
    getAllPosts: function(options, callback) {
      if (!callback) {
        callback = options;
        options = {};
      }
      var limit = options.numPerPage || 25; // if options.numPerPage is "falsy" then use 25
      var offset = (options.page || 0) * limit;

      conn.query(`
        SELECT p.id AS postId, p.title, p.url, p.userId, p.createdAt, p.updatedAt, u.id AS userId, u.username, u.createdAt AS userCreatedAt, u.updatedAt AS userUpdatedAt
        FROM posts p 
        JOIN users u 
        ON p.userId=u.id
        ORDER BY p.createdAt DESC
        LIMIT ? OFFSET ?
        `, [limit, offset],
        function(err, results) {

          if (err) {
            callback(err);
          }
          else {
            var newResults = results.map(function(obj) {
              var newObj = {};
              var userObj = {};
              newObj["id"] = obj.id;
              newObj["title"] = obj.title;
              newObj["url"] = obj.url;
              newObj["createdAt"] = obj.createdAt;
              newObj["updatedAt"] = obj.updatedAt;
              newObj["userId"] = obj.userId;
              newObj["user"] = userObj;
              userObj["id"] = obj.userId;
              userObj["username"] = obj.username;
              userObj["createdAt"] = obj.userCreatedAt;
              userObj["updatedAt"] = obj.userUpdatedAt;
              return newObj;
            });
            callback(null, newResults);
          }
        }
      );
    },
    getAllPostsForUser: function(userId, options, callback) {
      if (!callback) {
        callback = options;
        options = {};
      }
      var limit = options.numPerPage || 25;
      var offset = (options.page || 0) * limit;

      conn.query(`
        SELECT id AS postId, title, url, createdAt, updatedAt
        FROM posts p
        WHERE userId= ?
        ORDER BY p.id DESC
        LIMIT ? OFFSET ?
        `, [userId, limit, offset],

        function(err, results) {
          if (err) {
            callback(err);
          }
          else if (!results[0]) {
            callback(new Error("This user does not have any posts"));
          }
          else {
            callback(null, results);
          }
        }
      );
    },
    getSinglePost: function(postId, callback) {
      conn.query(`
        SELECT id, title, url, userId, createdAt, updatedAt
        FROM posts
        WHERE id= ?
        `, [postId],

        function(err, results) {
          if (err) {
            callback(err);
          }
          else if (!results[0]) {
            callback(new Error("This post does not exist."));
          }
          else {
            var resultsObj = results[0];
            callback(null, resultsObj);
          }
        }
      );
    },
    createSubreddit: function(sub, callback) {
    if (sub.description !== undefined) {
      conn.query(`INSERT INTO subreddits (name) VALUES (?)`, [sub.name],
        function(err, result) {
          if (err) {
            callback(err);
          }
          else {
            conn.query(
              `SELECT id, name FROM subreddits WHERE id=?`, [result.insertId],
              function(err, result) {
                if (err) {
                  callback(err);
                }
                else {
                  callback(null, result[0]);
                }
              }
            );
          }
        }
      );  
    }
    else {
        conn.query(`INSERT INTO subreddits (name, description) VALUES (?, ?)`, [sub.name, sub.description],
          function(err, result) {
            if (err) {
              callback(err);
            }
            else {
              conn.query(
                `SELECT id, name, description FROM subreddits WHERE id=?`, [result.insertId],
                function(err, result) {
                  if (err) {
                    callback(err);
                  }
                  else {
                    callback(null, result[0]);
                  }
                }
              );
            }
          }
        );
      }
    }
  };
};

