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
        'INSERT INTO `posts` (`userId`, `title`, `url`, `subredditId`, `createdAt`) VALUES (?, ?, ?, ?, ?)', [post.userId, post.title, post.url, post.subredditId, null],
        function(err, result) {
          if (err) {
            callback(err);
          }
          else {
            conn.query(
              'SELECT `id`,`title`,`url`,`userId`, `subredditId`, `createdAt`, `updatedAt` FROM `posts` WHERE `id` = ?', [result.insertId],
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
        SELECT p.id AS postId, p.title, p.url, p.userId, p.createdAt, p.updatedAt, s.id AS subredditId, s.name, s.description, s.createdAt AS subredditCreatedAt, s.updatedAt AS subredditUpdatedAt, u.id AS userId, u.username, u.createdAt AS userCreatedAt, u.updatedAt AS userUpdatedAt
        FROM posts p 
        JOIN users u 
        ON p.userId=u.id
        JOIN subreddits s
        ON p.subredditId=s.id
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
              var subObj = {};
              newObj["id"] = obj.postId;
              newObj["title"] = obj.title;
              newObj["url"] = obj.url;
              newObj["createdAt"] = obj.createdAt;
              newObj["updatedAt"] = obj.updatedAt;
              newObj["userId"] = obj.userId;
              newObj["subreddit"] = subObj;
              subObj["id"] = obj.subredditId;
              subObj["name"] = obj.name;
              subObj["description"] = obj.description;
              subObj["createdAt"] = obj.subredditCreatedAt;
              subObj["updatedAt"] = obj.subredditUpdatedAt;
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
      if (!sub.description) {
        conn.query(`INSERT INTO subreddits (name, createdAt) VALUES (?, null)`, [sub.name],
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
        conn.query(`INSERT INTO subreddits (name, description, createdAt) VALUES (?, ?, null)`, [sub.name, sub.description],
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
    },
    getAllSubreddits: function(options, callback) {
      if (!callback) {
        callback = options;
        options = {};
      }
      var limit = options.numPerPage || 25;
      var offset = (options.page || 0) * limit;

      conn.query(`SELECT id, name, description, createdAt, updatedAt FROM subreddits ORDER BY id LIMIT ? OFFSET ?`, [limit, offset],

        function(err, results) {
          if (err) {
            callback(err);
          }
          else if (!results[0]) {
            callback(new Error("No subreddits exist."));
          }
          else {
            callback(null, results);
          }
        }
      );
    },
    createComment: function(comment, callback) {

      conn.query(
        'INSERT INTO `comments` (`text`, `userId`, `postId`, `parentId`, `createdAt`) VALUES (?, ?, ? ,?, ?)', [comment.text, comment.userId, comment.postId, comment.parentId ? comment.parentId : null, null],
        function(err, result) {
          if (err || comment.parentId !== "number") {
            callback(new Error("Please check your paramenters"));
          }
          else {
            conn.query(
              'SELECT `id`, `text`, `userId`, `postId`, `parentId`, `createdAt`, `updatedAt` FROM `comments` WHERE `id` = ?', [result.insertId],
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
    getCommentsForPost: function(postId, callback) {
      conn.query(
        `SELECT c.id , c.text, c.createdAt, c.updatedAt, u.username, 
        c1.id AS c1Id, c1.text AS c1Text, c1.createdAt AS c1CreatedAt, c1.updatedAt AS c1UpdatedAt, c1.parentId AS c1ParentId, 
        c2.id AS c2Id, c2.text AS c2Text, c2.createdAt AS c2CreatedAt, c2.updatedAt AS c2UpdatedAt, c2.parentId AS c2ParentId
        FROM comments c
        LEFT JOIN comments c1 ON c.id=c1.parentId
        LEFT JOIN comments c2 ON c1.id=c2.parentId
        JOIN users u ON c.userId=u.id
        WHERE c.postId = ? AND c.parentId IS NULL
        ORDER BY c.createdAt, c1.createdAt, c2.createdAt`,
        [postId],

        function(err, results) {
          if (err) {
            callback(err);
          }
          else if (!results[0]) {
            callback(new Error("There are no comments for this post."));
          }
          else {
            // console.log(results);
            
            callback(null, results);
          }
        }
      );
    }
  };
};

