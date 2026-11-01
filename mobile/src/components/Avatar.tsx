import {StyleSheet, View} from "react-native";
import {User} from "lucide-react-native";
export  function Avatar(){
    return (
        <View style={styleObject.avatar}>
            <User size={50}/>
        </View>
    )
}

let styleObject = StyleSheet.create({
    avatar: {
        padding: 25,
        borderRadius: 9999,
        backgroundColor: "#333"
    }
})

