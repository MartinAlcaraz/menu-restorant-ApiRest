import Category from "../models/Category";
import Product from "../models/Product";
import ApiFeatures from "../Utils/ApiFeatures";
import CustomError from "../Utils/CustomError";
import asyncErrorHandler from "../Utils/asyncErrorHandler";

const productsCtrl = {};

productsCtrl.queryBestProducts = asyncErrorHandler(async (req, res, next) => {
    // setea la query en la url .get('products/popularProducts') sin necesidad de 
    // pasar la query desde el frontend.
    req.query.limit = '5';
    req.query.price = { gt: '2' };
    req.query.fields = "name,price,description,category";
    next();
});

// retorna los productos de la categoria pasada por id
productsCtrl.getProductsOfCategory = asyncErrorHandler(async (req, res, next) => {

    const category = await Category.findOne({name: {$regex: `^${req.params.categoryName}$` , $options: 'i'}});

    if (!category){
        const err = new CustomError("The category name '"+req.params.categoryName+"' does not exists.", 400);
        return next(err);
    }

    const products = await Product.find({ category: category._id });

    const result = await Category.populate(products, { path: "category", select: "name" });

    res.status(200).json({ status: 'OK', length: products.length, data: { products: result } });

});


productsCtrl.searchProducts = asyncErrorHandler(async (req, res, next) => {

    // se busca por insensitive case
    let products = await Product.find({ name: { $regex: req.query.name, $options: 'i' } });

    let result = {};
    if (products.length > 0) {
        result = await Category.populate(products, { path: "category", select: "name" });
    }

    res.status(200).json({ status: 'OK', length: products.length, data: { products: result } });

});


productsCtrl.getProducts = asyncErrorHandler(async (req, res, next) => {

    let result= {};

    if (Object.keys(req.query).length > 0) {
        // ApiFeatures => clase que recive las query del frontend y retorna un objeto query entendible para mongoose
        let features = await new ApiFeatures(Product.find(), req.query).filter().sort().limitFields().pagination();
        result = await features.query;

    }else{
        result = await Product.find();
    }

    res.status(200).json({ status: 'OK', count: result.length, data: { products: result } });

});

productsCtrl.getOneProduct = asyncErrorHandler(async (req, res, next) => {

    const product = await Product.findById(req.params.productId);

    if (!product) {
        const err = new CustomError("The product id does not exists.", 400);
        return next(err);
    }
    // product.populate devuelve el campo name, y no retorna el _id
    const result = await product.populate({ path: "category", select: "name -_id" });

    res.status(200).json({ status: 'OK', data: result });

});


productsCtrl.getStats = asyncErrorHandler(async (req, res, next) => {
    // se obtiene el promedio de precio de cada categoria de productos, el min, max, totalprice y totalproduct

    const stats = await Product.aggregate([
        {
            $match: {
                price: { $gte: 0 }
            }
        },
        {
            $group: {
                _id: '$category',       // agrupa por categoria
                avgPrice: { $avg: '$price' },
                minPrice: { $min: '$price' },
                maxPrice: { $max: '$price' },
                totalPrice: { $sum: '$price' },
                totalProducts: { $sum: 1 }
            }
        },
        {
            $sort: { totalProducts: 1 }  // ordena el resultado de mayor a menor
        }
    ]);

    const result = await Category.populate(stats, { path: "_id", select: "name" });

    res.status(200).json({ status: "OK", count: result.length, data: { stats: result } });

});

productsCtrl.postProduct = asyncErrorHandler(async (req, res, next) => {

    const { name, categoryId, description, price, imgURL } = req.body;

    const nameExists = await Product.findOne({ name: name });
    if (nameExists) {
        const err = new CustomError(`A product with the name '${name}' already exists.`, 409);
        return next(err);
    }

    const categoryExists = await Category.findById(categoryId);
    if (!categoryExists) {
        const err = new CustomError("The category does not exists.", 400);
        return next(err);
    }
    const productSaved = await Product.create({ name, price, description, imgURL, category: categoryId });

    if (!productSaved) {
        const err = new CustomError("Could not save the product", 400);
        return next(err);
    }

    res.status(201).json({ status: 'OK', data: 'Product created ' });
});

productsCtrl.updateProduct = asyncErrorHandler(async (req, res, next) => {

    const product = await Product.findById(req.params.productId);
    if (!product) {
        const err = new CustomError("The product does not exists", 404);
        return next(err);
    }

    const nameExists = await Product.findOne({ name: req.body.name });
    if (nameExists) {
        const err = new CustomError(`A product with the name '${name}' already exists.`, 409);
        return next(err);
    }

    const updatedProduct = await Product.findByIdAndUpdate(req.params.productId,
        {
            name: req.body.name,
            imgURL: req.body.imgURL,
            price: req.body.price
        },
        {
            runValidators: true,  // => para que se ejecuten los validadores del esquema de mongoose
            new: true  // =>  para que devuelva el registro nuevo, no el que fue actualizado
        });

    if (!updatedProduct) {
        const err = new CustomError("The product could not be updated.", 404);
        return next(err);
    }

    res.status(200).json({ status: 'OK', data: "The product " + updatedProduct.name + " was updated." });

});

productsCtrl.deleteProduct = asyncErrorHandler(async (req, res, next) => {

    const product = await Product.findById(req.params.productId);

    if (!product) {
        const err = new CustomError("The product does not exists.", 404);
        return next(err);
    }

    const productDeleted = await Product.findByIdAndDelete(req.params.productId);

    if (!productDeleted) {
        const err = new CustomError("Could not delete the product.", 400);
        return next(err);
    }
    res.status(200).json({ status: 'OK', message: "The product " + productDeleted.name + " was successfully deleted" });

});

export default productsCtrl;