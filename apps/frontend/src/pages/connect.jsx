import {React,useEffect} from 'react'
import Logo from '../components/Logo';

function Connect() {
    useEffect(() => {
        document.title = "MongoSnap - Connect";
    }, []);
    return (
        <div className="min-h-screen bg-gray-100 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center mb-6">
                        <Logo size="default" />
                        <h1 className="text-3xl font-bold text-gray-900">Connect</h1>
                    </div>
                    <p className="text-gray-600">Connect page content will go here.</p>
                </div>
            </div>
        </div>
    )
}

export default Connect