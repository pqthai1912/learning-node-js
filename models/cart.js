const fs = require('fs');
const path = require('path');

const p = path.join(
  path.dirname(process.mainModule.filename),
  'data',
  'cart.json'
);

const getCartsFromFile = cb => {
    fs.readFile(p, (err, fileContent) => {
        if (err || !fileContent || fileContent.length === 0) {
            cb({ products: [], totalPrice: 0 });
        } else {
            try {
                cb(JSON.parse(fileContent));
            } catch (parseError) {
                // In case the file content is not valid JSON
                cb({ products: [], totalPrice: 0 });
            }
        }
  });
};

module.exports = class Cart {
    static addProduct(id, productPrice) {
        // Fetch the previous cart
        getCartsFromFile(cart => {
            // Analyze the cart => Find existing product

            const existingProductIndex = cart.products.findIndex(prod => prod.id === id);
            const existingProduct = cart.products[existingProductIndex];
            let updatedProduct;
            if (existingProduct) {
                // Update product
                updatedProduct = { ...existingProduct };
                updatedProduct.qty++;
                cart.products = [...cart.products];
                cart.products[existingProductIndex] = updatedProduct;
            } else {
                // Add product
                updatedProduct = { id: id, qty: 1 };
                cart.products = [...cart.products, updatedProduct];
            }

            cart.totalPrice = cart.totalPrice + +productPrice;
            fs.writeFile(p, JSON.stringify(cart), err => {
                console.log(err);
            });
        });
    }

    static deleteProduct(id) {
        getCartsFromFile(cart => {
            const product = cart.products.find(prod => prod.id === id);
            if (!product) {
                return;
            }
            const updatedCart = {
                ...cart,
                products: cart.products.filter(prod => prod.id !== id),
                totalPrice: cart.totalPrice - product.price * product.qty
            };
            fs.writeFile(p, JSON.stringify(updatedCart), err => {
                console.log(err);
            });
        });
    }

    static getProducts(cb) {
        getCartsFromFile(cb);
    }
};