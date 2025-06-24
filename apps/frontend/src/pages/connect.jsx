import {React,useEffect} from 'react'


function Connect() {
    useEffect(() => {
        document.title = "MongoSnap - Connect";
    }, []);
    return (
        <div>
            <h1>Connect</h1>
        </div>
    )
}

export default Connect