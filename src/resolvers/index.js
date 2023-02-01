const path = require('path')
const fsPromises = require('fs/promises')
const { fileExists, readJsonFile, deleteFile, getDirectoryFileNames } = require('../utils/fileHandling')
const { GraphQLError } = require('graphql')
const crypto = require('node:crypto')
const { log } = require('console')
const { argsToArgsConfig } = require('graphql/type/definition')
const { response } = require('express')
const axios = require('axios').default

// Create a variable holding the file path (from computer root directory) to the project fiel directory
const cartDirectory = path.join(__dirname, '..', 'data', 'carts')
const productDirectory = path.join(__dirname, '../data/products')

exports.resolvers = {
	Query: {
		getCartById: async (_, args) => {
			const cartId = args.cartId

			const cartFilePath = path.join(cartDirectory, `${cartId}.json`)

			const cartExists = await fileExists(cartFilePath)

			if (!cartExists) {
				return new GraphQLError('That shopping cart does not exist')
			}

			const cartData = await fsPromises.readFile(cartFilePath, { encoding: 'utf-8' })

			const data = JSON.parse(cartData)

			return data
		},
		getAllCarts: async (_, args) => {
			const carts = await getDirectoryFileNames(cartDirectory)

			const cartData = []

			for (const file of carts) {
				const filePath = path.join(cartDirectory, file)
				const fileContents = await fsPromises.readFile(filePath, { encoding: 'utf-8' })
				const data = JSON.parse(fileContents)
				cartData.push(data)
			}
			return cartData
		},
	},
	Mutation: {
		createCart: async (_, args) => {
			if (args.cartName.length === 0) {
				return new GraphQLError('The cart name must be at least 1 character long')
			}

			const newCart = {
				cartId: crypto.randomUUID(),
				cartName: args.cartName,
				totalAmount: 0,
				products: [],
			}

			let filePath = path.join(cartDirectory, `${newCart.cartId}.json`)
			let idExists = true

			while (idExists) {
				const exists = await fileExists(filePath)
				console.log(exists, newCart.id)

				if (exists) {
					newCart.cartId = crypto.randomUUID()
					filePath = path.join(cartDirectory, `${newCart.cartId}.json`)
				}
				idExists = exists
			}

			await fsPromises.writeFile(filePath, JSON.stringify(newCart))

			return newCart
		},
		deleteCart: async (_, args) => {
			const cartId = args.cartId

			const filePath = path.join(cartDirectory, `${cartId}.json`)

			const cartExists = await fileExists(filePath)

			if (!cartExists) return new GraphQLError('That shopping cart does not exist')

			try {
				await deleteFile(filePath)
			} catch (error) {
				return {
					deletedId: cartId,
					success: false,
				}
			}

			return {
				deletedId: cartId,
				success: true,
			}
		},
		createProduct: async (_, args) => {
			const { productName, productPrice } = args.input

			if (productName.length === 0) {
				return new GraphQLError('The product name must be at least 1 character long')
			}

			const newProduct = {
				productId: crypto.randomUUID(),
				productName: productName,
				productPrice: productPrice,
				amount: 1,
			}

			let filePath = path.join(productDirectory, `${newProduct.productId}.json`)

			let idExists = true
			while (idExists) {
				const exists = await fileExists(filePath)
				console.log(exists, newProduct.productId)

				if (exists) {
					newProduct.productId = crypto.randomUUID()
					filePath = path.join(productDirectory, `${newProduct.productId}.json`)
				}
				idExists = exists
			}

			await fsPromises.writeFile(filePath, JSON.stringify(newProduct))

			return newProduct
		},
		deleteProduct: async (_, args) => {
			const productId = args.productId

			const filePath = path.join(productDirectory, `${productId}.json`)

			const productExists = await fileExists(filePath)

			if (!productExists) return new GraphQLError('That product does not exist')
			try {
				await deleteFile(filePath)
			} catch (error) {
				return {
					deletedId: productId,
					success: false,
				}
			}
			return {
				deletedId: productId,
				success: true,
			}
		},
		addProductToCart: async (_, args) => {
			const { cartId, productId } = args

			const cartFilePath = path.join(cartDirectory, `${cartId}.json`)
			const cartExists = await fileExists(cartFilePath)

			if (!cartExists) {
				return new GraphQLError('This shopping cart does not exist')
			}

			const productFilePath = path.join(productDirectory, `${productId}.json`)
			const productExists = await fileExists(productFilePath)

			if (!productExists) {
				return new GraphQLError('This product does not exist')
			}

			const cartData = await fsPromises.readFile(cartFilePath, { encoding: 'utf-8' })
			const shoppingcartData = JSON.parse(cartData)

			const productData = await fsPromises.readFile(productFilePath, { encoding: 'utf-8' })
			const productToAdd = JSON.parse(productData)

			const products = shoppingcartData.products
			const cartName = shoppingcartData.cartName
			let totalAmount = shoppingcartData.totalAmount
			totalAmount = 0

			for (let i = 0; i < shoppingcartData.products.length; i++) {
				//om produktId:t redan finns bland produkternas id:n

				if (shoppingcartData.products[i].productId === productId) {
					shoppingcartData.products[i].amount++

					for (let i = 0; i < shoppingcartData.products.length; i++) {
						totalAmount += shoppingcartData.products[i].productPrice * shoppingcartData.products[i].amount
					}
					const updatedCart = { cartId, cartName, totalAmount, products }
					await fsPromises.writeFile(cartFilePath, JSON.stringify(updatedCart))

					console.log(updatedCart)
					return updatedCart
				}
			}

			shoppingcartData.products.push(productToAdd)

			//upptadera totalamount
			for (let i = 0; i < shoppingcartData.products.length; i++) {
				totalAmount += shoppingcartData.products[i].productPrice * shoppingcartData.products[i].amount
			}
			/*********************************** */
			const updatedCart = { cartId, cartName, totalAmount, products }
			await fsPromises.writeFile(cartFilePath, JSON.stringify(updatedCart))

			console.log(updatedCart)
			return updatedCart
		},
		deleteProductFromCart: async (_, args) => {
			const { cartId, productId } = args

			const cartFilePath = path.join(cartDirectory, `${cartId}.json`)
			const cartExists = await fileExists(cartFilePath)

			if (!cartExists) {
				return new GraphQLError('This shopping cart does not exist')
			}

			const productFilePath = path.join(productDirectory, `${productId}.json`)
			const productExists = await fileExists(productFilePath)

			if (!productExists) {
				return new GraphQLError('This product does not exist')
			}

			const cartData = await fsPromises.readFile(cartFilePath, { encoding: 'utf-8' })
			const shoppingcartData = JSON.parse(cartData)

			const productData = await fsPromises.readFile(productFilePath, { encoding: 'utf-8' })
			const productToRemove = JSON.parse(productData)
			const products = shoppingcartData.products

			let index = products.indexOf(productToRemove)
			products.splice(index, 1)

			const cartName = shoppingcartData.cartName
			let totalAmount = shoppingcartData.totalAmount
			totalAmount = 0

			for (let i = 0; i < shoppingcartData.products.length; i++) {
				totalAmount += shoppingcartData.products[i].productPrice * shoppingcartData.products[i].amount
			}

			const updatedCart = { cartId, cartName, totalAmount, products }

			await fsPromises.writeFile(cartFilePath, JSON.stringify(updatedCart))

			console.log(updatedCart)
			return updatedCart
		},
		emptyCart: async (_, args) => {
			const { cartId } = args

			const cartFilePath = path.join(cartDirectory, `${cartId}.json`)
			const cartExists = await fileExists(cartFilePath)

			if (!cartExists) {
				return new GraphQLError('This shopping cart does not exist')
			}

			const cartData = await fsPromises.readFile(cartFilePath, { encoding: 'utf-8' })
			const shoppingcartData = JSON.parse(cartData)
			const cartName = shoppingcartData.cartName

			const products = shoppingcartData.products
			products.splice(0, products.length)

			let totalAmount = shoppingcartData.totalAmount
			totalAmount = 0

			const updatedCart = { cartId, cartName, totalAmount, products }

			await fsPromises.writeFile(cartFilePath, JSON.stringify(updatedCart))

			console.log(updatedCart)
			return updatedCart
		},
	},
}
