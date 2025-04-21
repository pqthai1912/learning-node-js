const Product = require('../models/product');
const Order = require('../models/order');
const OrderItem = require('../models/order-item');
const sequelize = require('../util/database');

exports.getProducts = (req, res, next) => {
  Product.findAll()
  .then(products => {
    res.render('shop/product-list', {
      prods: products,
      pageTitle: 'All Products',
      path: '/products'
    });
  })
  .catch(err => console.log(err));
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findByPk(prodId)
    .then(product => {
      res.render('shop/product-detail', {
        product: product,
        pageTitle: product.title,
        path: '/products'
      });
    })
    .catch(err => console.log(err));
};

exports.getIndex = (req, res, next) => {
  Product.findAll()
    .then(products => {
      res.render('shop/index', {
        prods: products,
        pageTitle: 'Shop',
        path: '/'
      });
    })
    .catch(err => console.log(err));
};

exports.getCart = (req, res, next) => {
  req.user.getCart()
    .then(cart => {
      return cart.getProducts()
        .then(products => {
          res.render('shop/cart', {
            path: '/cart',
            pageTitle: 'Your Cart',
            products: products
          });
        })
        .catch(err => console.log(err));
    }).catch(err => console.log(err));
};

/**
 * POST /cart
 * Add a product to the cart
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Function} next
 */
exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  let product;
  let cart;

  req.user.getCart()
  .then(foundCart => {
      cart = foundCart;
      // Check if the product already exists in the cart
      return cart.getProducts({ where: { id: prodId } })
        .then(products => {
          if (products.length > 0) {
            product = products[0];
            // Increase the quantity of the product
            const oldQuantity = product.cartItem.quantity;
            product.cartItem.quantity = oldQuantity + 1;
            cart.totalPrice += product.price;
            cart.totalItems += 1;
            // Save the updated product
            return product.cartItem.save()
              .then(() => {
                return cart.save();
              })
              .then(() => {
                res.redirect('/cart');
              })
              .catch(err => console.log(err));
          }

          // Add the product to the cart
          return Product.findByPk(prodId)
            .then(newProduct => {
              product = newProduct;
              return cart.addProduct(product, {
                through: {
                  quantity: 1,
                  price: product.price
                }
              });
            })
            .then(() => {
              // sum price
              cart.totalPrice += product.price;
              cart.totalItems += 1;
              return cart.save();
            })
            .then(() => {
              res.redirect('/cart');
            })
            .catch(err => console.log(err));
        })
        .catch(err => console.log(err));
    })
    .catch(err => console.log(err));
};

/**
 * POST /cart-delete-item
 * Delete a product from the cart
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Function} next
 */
exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user.getCart()
    .then(cart => {
      // Find the product in the cart
      return cart.getProducts({ where: { id: prodId } })
        .then(products => {
          const product = products[0];
          // Destroy the product in the cart
          return product.cartItem.destroy();
        })
        .then(() => {
          // Redirect to the cart page
          res.redirect('/cart');
        })
        .catch(err => console.log(err));
    })
    .catch(err => console.log(err));
};

exports.getOrders = (req, res, next) => {
  req.user.getOrders({ include: ['products'] })
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders,
      });
    })
    .catch(err => console.log(err));
};

/**
 * POST /orders
 * Create a new order from the cart
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Function} next
 */
exports.postOrder = (req, res, next) => {
  /**
   * Take an order and an array of products, and add each product to the order
   * @param {Order} order
   * @param {Product[]} products
   * @return {Promise<Order>}
   */
  const updateProducts = (order, products) => {
    const addProductPromises = products.map(product => {
      return order.addProduct(product, {
        through: {
          quantity: product.cartItem.quantity,
          price: product.price
        }
      });
    });
    return (Promise.all(addProductPromises)).then(() => order); // wait for all promises to resolve
  };

  /**
   * Create a new Order, and add all the products from the cart to the order
   * @param {Cart} cart
   * @return {Promise<Order>}
   */
  const createOrderWithProducts = (cart) => {
    return cart.getProducts()
      .then(products => {
        return req.user.createOrder({
          totalPrice: 0,
          totalItems: 0
        })
        .then(order => {
          return updateProducts(order, products) ;
        });
      });
  };

  /**
   * Update the totals for an order based on its products
   * @param {Order} order
   * @return {Promise<Order>}
   */
  const updateOrderTotals = (order) => {
    const orderId = order.id;
    return OrderItem.findAll({
      where: { OrderId: orderId },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('quantity')), 'totalQuantity'],
        [sequelize.fn('SUM', sequelize.literal('quantity * price')), 'totalPrice']
      ]
    })
      .then(result => {
        const totals = result[0].dataValues;
        return Order.findByPk(orderId)
          .then(order => {
            if (!order) {
              throw new Error('Order not found!');
            }
            order.totalItems = totals.totalQuantity || 0;
            order.totalPrice = totals.totalPrice || 0;
            return order.save();
          });
      })
      .catch(err => {
        console.log(err);
        throw err;
      });
  };

  /**
   * Clear the cart after creating the order
   * @param {Cart} cart
   * @return {Promise<Cart>}
   */
  const clearCart = (cart) => {
    return cart.setProducts(null);
  };

  req.user.getCart()
    .then(cart => createOrderWithProducts(cart))
    .then(order => updateOrderTotals(order))
    .then(() => req.user.getCart())
    .then(cart => clearCart(cart))
    .then(() => res.redirect('/orders'))
    .catch(err => console.log(err));
};

/**
 * GET /checkout
 * Render the checkout page
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Function} next
 */
exports.getCheckout = (req, res, next) => {
  res.render('shop/checkout', {
    path: '/checkout',
    pageTitle: 'Checkout'
  });
};
