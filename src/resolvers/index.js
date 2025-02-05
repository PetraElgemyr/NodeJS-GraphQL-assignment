const path = require('path')
const fsPromises = require('fs/promises')
const { fileExists, readJsonFile, deleteFile, getDirectoryFileNames } = require('../utils/fileHandling')
const { GraphQLError } = require('graphql')
const crypto = require('node:crypto')
const { productId } = require('../enums/products')

const { log } = require('console')
const { argsToArgsConfig } = require('graphql/type/definition')
const { response } = require('express')
const axios = require('axios').default

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
		getProductById: async (_, args) => {
			const productId = args.productId

			const productFilePath = path.join(productDirectory, `${productId}.json`)

			const productExists = await fileExists(productFilePath)

			if (!productExists) {
				return new GraphQLError('That product does not exist')
			}

			const productData = await fsPromises.readFile(productFilePath, { encoding: 'utf-8' })

			const data = JSON.parse(productData)

			return data
			;('')
		},
		getAllProducts: async (_, args) => {
			const products = await getDirectoryFileNames(productDirectory)

			const productData = []

			for (const file of products) {
				const filePath = path.join(productDirectory, file)
				const fileContents = await fsPromises.readFile(filePath, { encoding: 'utf-8' })
				const data = JSON.parse(fileContents)
				productData.push(data)
			}
			return productData
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
			const { cartId } = args
			const { productId } = args.input

			const productFilePath = path.join(productDirectory, `${productId}.json`)
			const productExists = await fileExists(productFilePath)

			if (!productExists) {
				return new GraphQLError('This product does not exist')
			}

			const cartFilePath = path.join(cartDirectory, `${cartId}.json`)
			const cartExists = await fileExists(cartFilePath)

			if (!cartExists) {
				return new GraphQLError('This shopping cart does not exist')
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

			for (let i = 0; i < shoppingcartData.products.length; i++) {
				totalAmount += shoppingcartData.products[i].productPrice * shoppingcartData.products[i].amount
			}

			const updatedCart = { cartId, cartName, totalAmount, products }
			await fsPromises.writeFile(cartFilePath, JSON.stringify(updatedCart))

			console.log(updatedCart)
			return updatedCart
		},
		deleteProductFromCart: async (_, args) => {
			const { cartId } = args
			const { productId } = args.input

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

			for (let i = 0; i < shoppingcartData.products.length; i++) {
				if (products[i].productId === productId) {
					products.splice(i, 1)

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
				}
				if (products[i].productId !== productId) {
					return new GraphQLError('This product does not exist in your chosen cart')
				}
			}
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
