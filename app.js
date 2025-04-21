const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');

const errorController = require('./controllers/error');

const sequelize = require('./util/database');

const Product = require('./models/product');
const User = require('./models/user');
const Cart = require('./models/cart');
const CartItem = require('./models/cart-item');
const Order = require('./models/order');
const OrderItem = require('./models/order-item');

const app = express();

app.set('view engine', 'ejs');
app.set('views', 'views');

const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    User.findByPk(1)
        .then(user => {
            req.user = user;
            next();
        })
        .catch(err => console.log(err));
});

app.use('/admin', adminRoutes);
app.use(shopRoutes);

app.use(errorController.get404);

Product.belongsTo(User, {
    constraints: true,
    onDelete: 'CASCADE'
});

User.hasMany(Product);
User.hasOne(Cart);
User.hasMany(Order);
Cart.belongsTo(User);
Cart.belongsToMany(Product, { through: CartItem });
Product.belongsToMany(Cart, { through: CartItem });
Order.belongsTo(User);
Order.belongsToMany(Product, { through: OrderItem });

sequelize
    // .sync({force: true}) // force: true will drop the table if it already exists
    .sync()
    .then(result => {
        return User.findByPk(1)
        .then(user => {
            if (!user) {
                return User.create({
                    name: 'Thai',
                    email: 'thai@example.com',
                    password: '123456'
                });
            }
            return user;
        });
    })
    .then(user => {
        return user.getCart()
        .then(foundCart => {
            if (!foundCart) {
                // Create a new cart if it doesn't exist
              return user.createCart({
                userId: user.id,
                totalPrice: 0,
                totalItems: 0
              })
              .then(newCart => {
                    return newCart;
                })
                .catch(err => console.log(err));
            }
          })
        .catch(err => console.log(err));
    })
    .then(() => {
        app.listen(3000, () => {
            console.log('Server is running on port 3000');
        });
    })
    .catch(err => {
        console.log(err);
    });